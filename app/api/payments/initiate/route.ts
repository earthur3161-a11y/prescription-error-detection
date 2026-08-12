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

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  // NEXT_PUBLIC_-prefixed even though this is read server-side here too —
  // the price is displayed to the patient before they pay, so it needs to
  // be readable client-side, and a single var avoids it drifting out of
  // sync with a hypothetical server-only twin.
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
  // Normalized the same way the OTP routes do — must match the exact string
  // self_check_accounts is keyed on for get_check_quota below to find the
  // row, and Paystack's mobile_money charge needs E.164 to route correctly.
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
  // Protects against charging real money off a stale client screen — if the
  // phone already has a free or already-paid-but-unconsumed credit, there's
  // nothing to charge for.
  if (quota.free_remaining > 0 || quota.paid_available > 0) {
    return Response.json(
      { error: "payment_not_required", message: "This phone number already has a check available." },
      { status: 409 }
    );
  }

  // Paystack's charge endpoint requires an email even for Mobile Money
  // charges; we only collect a phone number for this flow, so synthesize a
  // deterministic placeholder rather than asking the patient for one.
  const normalizedForEmail = phone.replace(/[^\d]/g, "");
  const syntheticEmail = `${normalizedForEmail}@checkout.mediguard.app`;

  const paystackRes = await fetch("https://api.paystack.co/charge", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: syntheticEmail,
      amount: amountPesewas,
      currency: "GHS",
      mobile_money: { phone, provider },
    }),
  });

  const paystackBody = (await paystackRes.json()) as {
    status?: boolean;
    message?: string;
    data?: { reference?: string; display_text?: string; status?: string };
  };

  if (!paystackRes.ok || !paystackBody.status || !paystackBody.data?.reference) {
    console.error("[payments/initiate] Paystack charge failed:", paystackRes.status, paystackBody);
    return Response.json(
      { error: "charge_failed", message: paystackBody.message ?? "Couldn't start the payment. Try again." },
      { status: 502 }
    );
  }

  const insert: CheckPaymentInsert = {
    phone,
    amount_pesewas: amountPesewas,
    provider: "paystack",
    provider_reference: paystackBody.data.reference,
    status: "pending",
  };
  const { error: insertError } = await supabaseService.from("check_payments").insert(insert);
  if (insertError) {
    console.error("[payments/initiate] Failed to record pending payment:", insertError);
    return Response.json({ error: "internal_error", message: "Couldn't start the payment. Try again." }, { status: 500 });
  }

  return Response.json({
    reference: paystackBody.data.reference,
    displayMessage: paystackBody.data.display_text ?? "Check your phone to approve the payment.",
  });
}
