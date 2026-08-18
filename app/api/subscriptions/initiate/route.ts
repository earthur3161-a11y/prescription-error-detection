import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import type { Database } from "@/lib/supabase/types";
import { toE164Gh } from "@/lib/utils/phone";

type SubscriptionPaymentInsert = Database["public"]["Tables"]["subscription_payments"]["Insert"];

const bodySchema = z.object({
  phone: z.string().min(6),
  provider: z.enum(["mtn", "vod", "atl"]),
});

const ROLE_PRODUCT: Record<"prescriber" | "pharmacist", "physician_portal" | "pharmacy_portal"> = {
  prescriber: "physician_portal",
  pharmacist: "pharmacy_portal",
};

const PRODUCT_PRICE_ENV: Record<"physician_portal" | "pharmacy_portal", string> = {
  physician_portal: "NEXT_PUBLIC_PHYSICIAN_PORTAL_PRICE_PESEWAS",
  pharmacy_portal: "NEXT_PUBLIC_PHARMACY_PORTAL_PRICE_PESEWAS",
};

const PERIOD_DAYS = 30;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

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

async function initializePaystackTransaction(
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
        // Charge endpoint worked - payment prompt is being sent to user's phone
        console.log("[subscriptions/initiate] Mobile Money charge initiated for reference:", chargeBody.data.reference);
        return {
          reference: chargeBody.data.reference,
          authorizationUrl: "",
        };
      }

      // If charge endpoint fails, try initialize endpoint for authorization URL
      if (!chargeRes.ok || !chargeBody.status) {
        console.warn("[subscriptions/initiate] Charge endpoint failed, trying initialize:", chargeBody.message);

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
            "[subscriptions/initiate] Transaction initialized with authorization URL for reference:",
            initBody.data.reference
          );
          return {
            reference: initBody.data.reference,
            authorizationUrl: initBody.data.authorization_url,
          };
        }

        lastError = new Error(initBody.message ?? chargeBody.message ?? "Paystack payment initialization failed");
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

  console.error("[subscriptions/initiate] Paystack payment initialization failed after retries:", lastError);
  return null;
}

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[subscriptions/initiate] Missing PAYSTACK_SECRET_KEY.");
    return Response.json({ error: "not_configured", message: "Payments are not fully configured yet." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return Response.json({ error: "unauthorized", message: "Missing bearer token." }, { status: 401 });
  }
  const { data: callerData, error: callerError } = await supabaseService.auth.getUser(token);
  if (callerError || !callerData.user) {
    return Response.json({ error: "unauthorized", message: "Invalid or expired session." }, { status: 401 });
  }
  const role = callerData.user.app_metadata?.role as "prescriber" | "pharmacist" | undefined;
  if (role !== "prescriber" && role !== "pharmacist") {
    return Response.json(
      { error: "forbidden", message: "Only Physician and Pharmacy Portal accounts subscribe here." },
      { status: 403 }
    );
  }
  const product = ROLE_PRODUCT[role];

  const priceStr = process.env[PRODUCT_PRICE_ENV[product]];
  const amountPesewas = Number(priceStr);
  if (!priceStr || !Number.isFinite(amountPesewas) || amountPesewas <= 0) {
    console.error(`[subscriptions/initiate] Missing/invalid ${PRODUCT_PRICE_ENV[product]}:`, priceStr);
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

  const { data: existing } = await supabaseService
    .from("subscriptions")
    .select("status, period_end")
    .eq("owner_id", callerData.user.id)
    .eq("product", product)
    .maybeSingle();
  if (existing?.status === "active" && existing.period_end && new Date(existing.period_end) > new Date()) {
    return Response.json({ error: "already_active", message: "Your subscription is already active." }, { status: 409 });
  }

  const { data: pendingPayments } = await supabaseService
    .from("subscription_payments")
    .select("id, created_at")
    .eq("owner_id", callerData.user.id)
    .eq("product", product)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (pendingPayments && pendingPayments.length > 0) {
    const oldestPending = pendingPayments[0];
    const createdAt = new Date(oldestPending.created_at);
    const ageMs = Date.now() - createdAt.getTime();
    const fiveMinutesMs = 5 * 60 * 1000;

    if (ageMs < fiveMinutesMs) {
      const oldestReference = pendingPayments[0];
      console.warn(
        `[subscriptions/initiate] User ${callerData.user.id} attempted new payment while one is still pending`
      );
      const { data: oldPayment } = await supabaseService
        .from("subscription_payments")
        .select("provider_reference")
        .eq("id", oldestReference.id)
        .maybeSingle();

      return Response.json(
        {
          error: "payment_in_progress",
          message: "A payment is already in progress. Please wait a few moments and try again.",
          reference: oldPayment?.provider_reference ?? undefined,
        },
        { status: 409 }
      );
    }

    for (const payment of pendingPayments) {
      await supabaseService
        .from("subscription_payments")
        .update({ status: "failed" })
        .eq("id", payment.id);
    }
  }

  const email = callerData.user.email ?? `${callerData.user.id}@subscriber.mediguard.app`;

  const paystackResult = await initializePaystackTransaction(secretKey, email, amountPesewas, phone, provider);

  if (!paystackResult) {
    return Response.json(
      { error: "charge_failed", message: "Couldn't start the payment. Please try again." },
      { status: 502 }
    );
  }

  const insert: SubscriptionPaymentInsert = {
    owner_id: callerData.user.id,
    product,
    amount_pesewas: amountPesewas,
    period_days: PERIOD_DAYS,
    provider: "paystack",
    provider_reference: paystackResult.reference,
    status: "pending",
  };
  const { error: insertError } = await supabaseService.from("subscription_payments").insert(insert);
  if (insertError) {
    console.error("[subscriptions/initiate] Failed to record pending payment:", insertError);
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
