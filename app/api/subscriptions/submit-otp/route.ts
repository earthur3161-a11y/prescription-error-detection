import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { submitPaystackOtp } from "@/lib/payments/paystackCharge";
import { resolveSubscriptionPayment } from "@/lib/payments/resolveSubscriptionPayment";

/**
 * POST /api/subscriptions/submit-otp
 *
 * The missing half of the "send_otp" Mobile Money flow: when
 * /api/subscriptions/initiate reports awaitingOtp: true, Paystack is
 * waiting for the OTP it sent the customer to be relayed back via
 * POST /charge/submit_otp before the charge will actually go through — see
 * lib/payments/paystackCharge.ts's header for why. This route is that
 * relay. It doesn't resolve subscription_payments' own status itself; the
 * existing /verify poll (or the webhook) observes the outcome once
 * Paystack processes it, same as every other Paystack-side event in this
 * flow — the only field this route writes to that table is awaiting_otp
 * (so a reload can tell this payment is/was mid-OTP) and
 * otp_submit_attempts (an attempt cap, below).
 *
 * OTP_MAX_SUBMIT_ATTEMPTS mirrors OTP_MAX_VERIFY_ATTEMPTS in
 * app/api/otp/verify/route.ts — an adversarial review found this route had
 * no attempt limit at all, unlike its SMS-OTP sibling, letting a caller
 * (anyone holding a valid bearer token for their own account, or a stolen
 * one) hammer /charge/submit_otp indefinitely.
 *
 * Auth/ownership pattern copied from app/api/subscriptions/verify/route.ts.
 */

const bodySchema = z.object({ reference: z.string().min(1), otp: z.string().min(1) });

const OTP_MAX_SUBMIT_ATTEMPTS = 5;

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[subscriptions/submit-otp] Missing PAYSTACK_SECRET_KEY.");
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
    .from("subscription_payments")
    .select("owner_id, status, otp_submit_attempts")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (lookupError) {
    console.error("[subscriptions/submit-otp] Lookup failed:", lookupError);
    return Response.json({ error: "internal_error", message: "Couldn't submit the code." }, { status: 500 });
  }
  if (!paymentRow || paymentRow.owner_id !== callerData.user.id) {
    return Response.json({ error: "not_found", message: "Payment reference not found." }, { status: 404 });
  }
  if (paymentRow.status !== "pending") {
    return Response.json({ ok: false, message: "This payment is no longer waiting for a code." });
  }
  if (paymentRow.otp_submit_attempts >= OTP_MAX_SUBMIT_ATTEMPTS) {
    await resolveSubscriptionPayment(reference, false);
    return Response.json({ ok: false, message: "Too many incorrect attempts. Please start a new payment." });
  }

  const result = await submitPaystackOtp(secretKey, reference, otp);

  if (result.ok) {
    await supabaseService.from("subscription_payments").update({ awaiting_otp: false }).eq("provider_reference", reference);
  } else if (!result.transient) {
    // Only a genuine wrong-code rejection counts against the cap — a
    // network hiccup on our/Paystack's end isn't the customer's fault.
    await supabaseService
      .from("subscription_payments")
      .update({ otp_submit_attempts: paymentRow.otp_submit_attempts + 1 })
      .eq("provider_reference", reference);
  }

  return Response.json({ ok: result.ok, message: result.message });
}
