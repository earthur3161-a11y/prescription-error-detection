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

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error("[payments/paystack-webhook] Failed to read request body:", err);
    return Response.json({ ok: true });
  }

  const signature = request.headers.get("x-paystack-signature");
  if (!signature) {
    console.error("[payments/paystack-webhook] Missing x-paystack-signature header");
    return Response.json({ ok: true });
  }

  if (!verifyPaystackSignature(rawBody, signature, secretKey)) {
    console.error("[payments/paystack-webhook] Signature verification failed for webhook");
    return Response.json({ ok: true });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error("[payments/paystack-webhook] Failed to parse JSON:", err);
    return Response.json({ ok: true });
  }

  const reference = event.data?.reference;
  const status = event.data?.status;

  if (!reference || !status) {
    console.warn("[payments/paystack-webhook] Missing reference or status in webhook data", { reference, status });
    return Response.json({ ok: true });
  }

  const succeeded = status === "success";
  const failed = status === "failed" || status === "abandoned" || status === "reversed";

  if (!succeeded && !failed) {
    console.info(`[payments/paystack-webhook] Ignoring non-terminal status: ${status}`);
    return Response.json({ ok: true });
  }

  console.info(
    `[payments/paystack-webhook] Processing ${succeeded ? "success" : "failed"} payment: ${reference}`
  );

  const { data: checkPaymentRows, error: checkPaymentError } = await supabaseService
    .from("check_payments")
    .update(succeeded ? { status: "success", verified_at: new Date().toISOString() } : { status: "failed" })
    .eq("provider_reference", reference)
    .eq("status", "pending")
    .select("id");

  if (checkPaymentError) {
    console.error("[payments/paystack-webhook] Failed to update check_payments:", checkPaymentError);
  } else if (checkPaymentRows && checkPaymentRows.length > 0) {
    console.info(`[payments/paystack-webhook] Updated check_payments for reference: ${reference}`);
    return Response.json({ ok: true });
  }

  if (!checkPaymentRows || checkPaymentRows.length === 0) {
    try {
      const result = await resolveSubscriptionPayment(reference, succeeded);
      if (result.resolved) {
        console.info(`[payments/paystack-webhook] Resolved subscription payment: ${reference}`);
      } else {
        console.warn(
          `[payments/paystack-webhook] Payment reference not found in either table: ${reference}`
        );
      }
    } catch (err) {
      console.error("[payments/paystack-webhook] Failed to resolve subscription_payments:", err);
    }
  }

  return Response.json({ ok: true });
}
