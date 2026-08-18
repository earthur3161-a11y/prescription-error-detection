import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import type { Database } from "@/lib/supabase/types";
import { toE164Gh } from "@/lib/utils/phone";

type CheckPaymentInsert = Database["public"]["Tables"]["check_payments"]["Insert"];

const bodySchema = z.object({
  phone: z.string().min(6),
  provider: z.enum(["mtn", "vod", "atl"]),
});

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackChargeResponse {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    authorization_url?: string;
  };
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

async function initializeCheckPayment(
  secretKey: string,
  email: string,
  amount: number,
  phone: string,
  provider: string
): Promise<{ reference: string; authorizationUrl: string } | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Try charge endpoint first for immediate Mobile Money prompt
      const chargeRes = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount,
          currency: "GHS",
          mobile_money: { phone, provider },
        }),
      });

      const chargeBody = (await chargeRes.json()) as PaystackChargeResponse;

      if (chargeRes.ok && chargeBody.status && chargeBody.data?.reference) {
        console.log("[payments/initiate] Mobile Money charge initiated for reference:", chargeBody.data.reference);
        return {
          reference: chargeBody.data.reference,
          authorizationUrl: "",
        };
      }

      // If charge endpoint fails, try initialize endpoint
      if (!chargeRes.ok || !chargeBody.status) {
        console.warn("[payments/initiate] Charge endpoint failed, trying initialize:", chargeBody.message);

        const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            amount,
            currency: "GHS",
            channels: ["mobile_money"],
          }),
        });

        const initBody = (await initRes.json()) as PaystackInitializeResponse;

        if (initRes.ok && initBody.status && initBody.data?.reference && initBody.data?.authorization_url) {
          console.log(
            "[payments/initiate] Transaction initialized with authorization URL for reference:",
            initBody.data.reference
          );
          return {
            reference: initBody.data.reference,
            authorizationUrl: initBody.data.authorization_url,
          };
        }

        lastError = new Error(initBody.message ?? chargeBody.message ?? "Payment initialization failed");
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
          continue;
        }
        break;
      }

      return {
        reference: chargeBody.data.reference,
        authorizationUrl: chargeBody.data.authorization_url ?? "",
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  console.error("[payments/initiate] Payment initialization failed after retries:", lastError);
  return null;
}

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  const priceStr = process.env.NEXT_PUBLIC_CHECK_PRICE_PESEWAS;
  if (!secretKey || !priceStr) {
    console.error("[payments/initiate] Missing PAYSTACK_SECRET_KEY / NEXT_PUBLIC_CHECK_PRICE_PESEWAS.");
    return Response.json({ error: "not_configured", message: "Payments are not fully configured yet." }, { status: 500 });
  }
  const amountPesewas = Number(priceStr);
  if (!Number.isFinite(amountPesewas) || amountPesewas <= 0) {
    console.error("[payments/initiate] NEXT_PUBLIC_CHECK_PRICE_PESEWAS is not a positive number:", priceStr);
    return Response.json({ error: "not_configured", message: "Payments are not fully configured yet." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", message: "A phone number and mobile money provider (mtn/vod/atl) are required." },
      { status: 422 }
    );
  }

  const phone = toE164Gh(parsed.data.phone);
  const { provider } = parsed.data;

  const { data: quotaRows, error: quotaError } = await supabaseService.rpc("get_check_quota", { p_phone: phone });
  if (quotaError) {
    console.error("[payments/initiate] get_check_quota failed:", quotaError);
    return Response.json({ error: "internal_error", message: "Couldn't check payment eligibility." }, { status: 500 });
  }
  const quota = quotaRows?.[0];
  if (!quota?.phone_verified) {
    return Response.json({ error: "not_verified", message: "This phone number hasn't been verified yet." }, { status: 403 });
  }

  if (quota.free_remaining > 0 || quota.paid_available > 0) {
    return Response.json(
      { error: "payment_not_required", message: "This phone number already has a check available." },
      { status: 409 }
    );
  }

  const normalizedForEmail = phone.replace(/[^\d]/g, "");
  const syntheticEmail = `${normalizedForEmail}@checkout.mediguard.app`;

  const paystackResult = await initializeCheckPayment(secretKey, syntheticEmail, amountPesewas, phone, provider);

  if (!paystackResult) {
    return Response.json(
      { error: "charge_failed", message: "Couldn't start the payment. Try again." },
      { status: 502 }
    );
  }

  const insert: CheckPaymentInsert = {
    phone,
    amount_pesewas: amountPesewas,
    provider: "paystack",
    provider_reference: paystackResult.reference,
    status: "pending",
  };
  const { error: insertError } = await supabaseService.from("check_payments").insert(insert);
  if (insertError) {
    console.error("[payments/initiate] Failed to record pending payment:", insertError);
    return Response.json({ error: "internal_error", message: "Couldn't start the payment. Try again." }, { status: 500 });
  }

  return Response.json({
    reference: paystackResult.reference,
    authorizationUrl: paystackResult.authorizationUrl,
    displayMessage: paystackResult.authorizationUrl
      ? "Opening payment page..."
      : "Payment prompt sent to your phone. Check your messages.",
  });
}
