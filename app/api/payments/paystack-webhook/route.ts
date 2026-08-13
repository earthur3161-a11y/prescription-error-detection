import "server-only";
import { verifyPaystackSignature } from "@/lib/payments/verifyPaystackSignature";
import { resolveSubscriptionPayment } from "@/lib/payments/resolveSubscriptionPayment";
import { supabaseService } from "@/lib/supabase/serviceClient";

// Paystack webhook for Mobile Money charge confirmation. Configure in the
// Paystack dashboard -> Settings -> API Keys & Webhooks -> paste this
// route's deployed URL.
//
// Deliberately NOT validated at module scope — same lesson as
// send-email-hook: a build-time throw here would fail the entire Vercel
// deployment, not just this route. Checked per-request instead.

interface PaystackWebhookEvent {
  event?: string;
  data?: { reference?: string; status?: string };
}

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    console.error("[payments/paystack-webhook] Missing PAYSTACK_SECRET_KEY.");
    return Response.json({ error: "not_configured" }, { status: 500 });
  }

  // Raw body BEFORE verifying — signature is over the exact bytes sent.
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!signature || !verifyPaystackSignature(rawBody, signature, secretKey)) {
    console.error("[payments/paystack-webhook] signature verification failed");
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const reference = event.data?.reference;
  const status = event.data?.status;
  if (!reference || !status) {
    return Response.json({ ok: true });
  }

  const succeeded = status === "success";
  const failed = status === "failed" || status === "abandoned" || status === "reversed";
  if (!succeeded && !failed) {
    return Response.json({ ok: true });
  }

  // Check the actual data.status field, not just the event name — and
  // guard the update with .eq("status", "pending") so a redelivered webhook
  // is a safe no-op and a stray out-of-order "failed" can't downgrade an
  // already-successful payment.
  const { data: checkPaymentRows, error: checkPaymentError } = await supabaseService
    .from("check_payments")
    .update(succeeded ? { status: "success", verified_at: new Date().toISOString() } : { status: "failed" })
    .eq("provider_reference", reference)
    .eq("status", "pending")
    .select("id");
  if (checkPaymentError) console.error("[payments/paystack-webhook] Failed to update check_payments:", checkPaymentError);

  // A given reference belongs to exactly one of the two payment tables
  // (self-check pay-as-you-go vs. Physician/Pharmacy subscription) — only
  // look at subscription_payments if it wasn't a check_payments row.
  if (!checkPaymentRows || checkPaymentRows.length === 0) {
    try {
      await resolveSubscriptionPayment(reference, succeeded);
    } catch (err) {
      console.error("[payments/paystack-webhook] Failed to resolve subscription_payments:", err);
    }
  }

  // Always a JSON 200 — a null body / non-2xx response makes Paystack keep
  // retrying delivery.
  return Response.json({ ok: true });
}
