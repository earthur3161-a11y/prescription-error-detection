import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { resolveCheckPayment } from "@/lib/payments/resolveCheckPayment";

/**
 * POST /api/payments/verify
 *
 * The check_payments equivalent of /api/subscriptions/verify — same reason
 * for existing: a webhook alone was already proven unreliable for the
 * sibling subscription flow (see that route's own header), and Patient
 * Self-Check had no fallback at all until now. Asks Paystack directly
 * (GET /transaction/verify/:reference) whenever the row is still "pending"
 * rather than depending solely on the webhook having fired, and self-heals
 * via the same resolution logic the webhook uses. checkQuotaRepository's
 * getPaymentStatus now calls this instead of reading check_payments (via the
 * old get_payment_status RPC) directly, so the existing 3-second poll in
 * usePaymentStatus becomes self-healing.
 *
 * No auth required — this flow is anonymous by design (phone-verified via
 * OTP, not a Supabase session). The Paystack reference itself is the
 * credential, same trust model get_payment_status already used.
 */

const bodySchema = z.object({ reference: z.string().min(1) });

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[payments/verify] Missing PAYSTACK_SECRET_KEY.");
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
    return Response.json({ error: "invalid_request", message: "A payment reference is required." }, { status: 422 });
  }
  const { reference } = parsed.data;

  const { data: paymentRow, error: lookupError } = await supabaseService
    .from("check_payments")
    .select("status")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (lookupError) {
    console.error("[payments/verify] Lookup failed:", lookupError);
    return Response.json({ error: "internal_error", message: "Couldn't check payment status." }, { status: 500 });
  }
  if (!paymentRow) {
    return Response.json({ error: "not_found", message: "Payment reference not found." }, { status: 404 });
  }

  // Already resolved (by the webhook, or a previous call to this route) —
  // cheap no-op, no need to ask Paystack again.
  if (paymentRow.status !== "pending") {
    return Response.json({ status: paymentRow.status });
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const verifyBody = (await verifyRes.json()) as { data?: { status?: string } };
  const paystackStatus = verifyBody.data?.status;

  if (paystackStatus === "success") {
    await resolveCheckPayment(reference, true);
    return Response.json({ status: "success" });
  }
  if (paystackStatus === "failed" || paystackStatus === "abandoned" || paystackStatus === "reversed") {
    await resolveCheckPayment(reference, false);
    return Response.json({ status: "failed" });
  }
  return Response.json({ status: "pending" });
}
