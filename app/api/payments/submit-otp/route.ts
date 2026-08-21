import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { submitPaystackOtp } from "@/lib/payments/paystackCharge";
import { resolveCheckPayment } from "@/lib/payments/resolveCheckPayment";

/**
 * POST /api/payments/submit-otp
 *
 * The check_payments equivalent of /api/subscriptions/submit-otp — same
 * reason for existing (see that route's header and
 * lib/payments/paystackCharge.ts). No auth required, same anonymous/
 * phone-verified trust model as app/api/payments/verify/route.ts: the
 * Paystack reference itself is the credential.
 *
 * OTP_MAX_SUBMIT_ATTEMPTS matters even more here than on the subscriptions
 * side: this route is reachable by anyone who has the reference at all
 * (no bearer token/ownership check by design), so an attempt cap is the
 * only thing standing between an unauthenticated caller and unlimited
 * OTP guesses against a live Mobile Money charge. Mirrors
 * OTP_MAX_VERIFY_ATTEMPTS in app/api/otp/verify/route.ts.
 */

const bodySchema = z.object({ reference: z.string().min(1), otp: z.string().min(1) });

const OTP_MAX_SUBMIT_ATTEMPTS = 5;

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[payments/submit-otp] Missing PAYSTACK_SECRET_KEY.");
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
    return Response.json({ error: "invalid_request", message: "A reference and OTP are required." }, { status: 422 });
  }
  const { reference, otp } = parsed.data;

  const { data: paymentRow, error: lookupError } = await supabaseService
    .from("check_payments")
    .select("status, otp_submit_attempts")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (lookupError) {
    console.error("[payments/submit-otp] Lookup failed:", lookupError);
    return Response.json({ error: "internal_error", message: "Couldn't submit the code." }, { status: 500 });
  }
  if (!paymentRow) {
    return Response.json({ error: "not_found", message: "Payment reference not found." }, { status: 404 });
  }
  if (paymentRow.status !== "pending") {
    return Response.json({ ok: false, message: "This payment is no longer waiting for a code." });
  }
  if (paymentRow.otp_submit_attempts >= OTP_MAX_SUBMIT_ATTEMPTS) {
    await resolveCheckPayment(reference, false);
    return Response.json({ ok: false, message: "Too many incorrect attempts. Please start a new payment." });
  }

  const result = await submitPaystackOtp(secretKey, reference, otp);

  if (result.ok) {
    await supabaseService.from("check_payments").update({ awaiting_otp: false }).eq("provider_reference", reference);
  } else if (!result.transient) {
    await supabaseService
      .from("check_payments")
      .update({ otp_submit_attempts: paymentRow.otp_submit_attempts + 1 })
      .eq("provider_reference", reference);
  }

  return Response.json({ ok: result.ok, message: result.message });
}
