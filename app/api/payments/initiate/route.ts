import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import type { Database } from "@/lib/supabase/types";
import { toE164Gh } from "@/lib/utils/phone";
import { initiatePaystackMobileMoneyCharge } from "@/lib/payments/paystackCharge";

type CheckPaymentInsert = Database["public"]["Tables"]["check_payments"]["Insert"];

const bodySchema = z.object({
  phone: z.string().min(6),
  provider: z.enum(["mtn", "vod", "atl"]),
});

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

  const paystackResult = await initiatePaystackMobileMoneyCharge(
    secretKey,
    syntheticEmail,
    amountPesewas,
    phone,
    provider,
    "[payments/initiate]"
  );

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
    awaiting_otp: paystackResult.awaitingOtp,
  };
  const { error: insertError } = await supabaseService.from("check_payments").insert(insert);
  if (insertError) {
    console.error("[payments/initiate] Failed to record pending payment:", insertError);
    return Response.json({ error: "internal_error", message: "Couldn't start the payment. Try again." }, { status: 500 });
  }

  return Response.json({
    reference: paystackResult.reference,
    authorizationUrl: paystackResult.authorizationUrl,
    awaitingOtp: paystackResult.awaitingOtp,
    displayMessage: paystackResult.displayMessage,
  });
}
