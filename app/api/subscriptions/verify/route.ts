import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { resolveSubscriptionPayment } from "@/lib/payments/resolveSubscriptionPayment";

/**
 * POST /api/subscriptions/verify
 *
 * The fallback path the webhook alone was never enough to guarantee: every
 * subscription_payments row in this project's history was found stuck on
 * "pending" — including at least one confirmed real Mobile Money charge
 * (money moved, portal never unlocked) — most likely because the Paystack
 * dashboard's webhook URL was never actually pointed at this deployment
 * (webhook config lives entirely in Paystack's dashboard, invisible to this
 * codebase, same class of gap as an SMS provider's sandbox-vs-live username).
 *
 * Rather than depend on that dashboard setting being correct, this route
 * asks Paystack directly — GET /transaction/verify/:reference, the actual
 * source of truth — and self-heals via the exact same activation logic the
 * webhook uses (resolveSubscriptionPayment). billing/page.tsx's existing
 * 3-second poll now calls this instead of reading subscription_payments
 * directly, so a payment resolves within one poll tick even if the webhook
 * never fires at all, not just when it does.
 */

const bodySchema = z.object({ reference: z.string().min(1) });

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[subscriptions/verify] Missing PAYSTACK_SECRET_KEY.");
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
    return Response.json({ error: "invalid_request", message: "A payment reference is required." }, { status: 422 });
  }
  const { reference } = parsed.data;

  // Ownership check — a caller can only ever resolve/observe their own
  // payment, never probe or trigger activation for someone else's reference.
  const { data: paymentRow, error: lookupError } = await supabaseService
    .from("subscription_payments")
    .select("owner_id, status")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (lookupError) {
    console.error("[subscriptions/verify] Lookup failed:", lookupError);
    return Response.json({ error: "internal_error", message: "Couldn't check payment status." }, { status: 500 });
  }
  if (!paymentRow || paymentRow.owner_id !== callerData.user.id) {
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
    await resolveSubscriptionPayment(reference, true);
    return Response.json({ status: "success" });
  }
  if (paystackStatus === "failed" || paystackStatus === "abandoned" || paystackStatus === "reversed") {
    await resolveSubscriptionPayment(reference, false);
    return Response.json({ status: "failed" });
  }
  // Genuinely still pending on Paystack's own side too (customer hasn't
  // approved the Mobile Money prompt yet), or the verify call itself
  // couldn't be completed — either way, still pending; the client keeps
  // polling and will call this again in 3s.
  return Response.json({ status: "pending" });
}
