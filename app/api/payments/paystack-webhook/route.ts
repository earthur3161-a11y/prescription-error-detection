import "server-only";
import { verifyPaystackSignature } from "@/lib/payments/verifyPaystackSignature";
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

  // Check the actual data.status field, not just the event name — and
  // guard the update with .eq("status", "pending") so a redelivered webhook
  // is a safe no-op and a stray out-of-order "failed" can't downgrade an
  // already-successful payment.
  if (status === "success") {
    const { error } = await supabaseService
      .from("check_payments")
      .update({ status: "success", verified_at: new Date().toISOString() })
      .eq("provider_reference", reference)
      .eq("status", "pending");
    if (error) console.error("[payments/paystack-webhook] Failed to mark payment success:", error);
  } else if (status === "failed" || status === "abandoned" || status === "reversed") {
    const { error } = await supabaseService
      .from("check_payments")
      .update({ status: "failed" })
      .eq("provider_reference", reference)
      .eq("status", "pending");
    if (error) console.error("[payments/paystack-webhook] Failed to mark payment failed:", error);
  }

  // Always a JSON 200 — a null body / non-2xx response makes Paystack keep
  // retrying delivery.
  return Response.json({ ok: true });
}
