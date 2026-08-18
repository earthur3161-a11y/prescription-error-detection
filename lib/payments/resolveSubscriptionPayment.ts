import "server-only";
import { supabaseService } from "../supabase/serviceClient";

/**
 * The one place a subscription_payments row is ever resolved out of
 * "pending" and, on success, a subscriptions row is activated. Shared by the
 * Paystack webhook (app/api/payments/paystack-webhook/route.ts, the fast
 * path when Paystack's dashboard webhook is actually configured and
 * reachable) and app/api/subscriptions/verify/route.ts (the fallback path —
 * see that file's own header for why a webhook alone isn't good enough:
 * every subscription_payments row in this project's history was found stuck
 * on "pending" with a confirmed real charge behind at least one of them,
 * because nothing was ever independently re-checking with Paystack itself).
 *
 * Guarded by .eq("status", "pending") so this is safe to call more than
 * once for the same reference (webhook retry, or webhook AND verify racing
 * each other) — whichever caller gets there first wins, the second is a
 * no-op (`payment` below comes back undefined, activation is skipped).
 */
export async function resolveSubscriptionPayment(reference: string, succeeded: boolean): Promise<{ resolved: boolean }> {
  try {
    const { data: subPaymentRows, error: subPaymentError } = await supabaseService
      .from("subscription_payments")
      .update(
        succeeded ? { status: "success", verified_at: new Date().toISOString() } : { status: "failed" }
      )
      .eq("provider_reference", reference)
      .eq("status", "pending")
      .select("id, owner_id, product, period_days");

    if (subPaymentError) {
      console.error("[resolveSubscriptionPayment] Failed to update payment status:", subPaymentError);
      throw subPaymentError;
    }

    const payment = subPaymentRows?.[0];
    if (!succeeded || !payment) {
      return { resolved: !!payment };
    }

    const { data: existing, error: selectError } = await supabaseService
      .from("subscriptions")
      .select("period_end")
      .eq("owner_id", payment.owner_id)
      .eq("product", payment.product)
      .maybeSingle();

    if (selectError) {
      console.error("[resolveSubscriptionPayment] Failed to fetch existing subscription:", selectError);
      throw selectError;
    }

    const currentEnd = existing?.period_end ? new Date(existing.period_end) : null;
    const now = new Date();
    const base = currentEnd && currentEnd > now ? currentEnd : now;
    const newPeriodEnd = new Date(base.getTime() + payment.period_days * 24 * 60 * 60 * 1000);

    const { error: upsertError } = await supabaseService.from("subscriptions").upsert(
      {
        owner_id: payment.owner_id,
        product: payment.product,
        status: "active",
        period_end: newPeriodEnd.toISOString(),
        provider_reference: reference,
      },
      { onConflict: "owner_id,product" }
    );

    if (upsertError) {
      console.error("[resolveSubscriptionPayment] Failed to upsert subscription:", upsertError);
      throw upsertError;
    }

    return { resolved: true };
  } catch (err) {
    console.error("[resolveSubscriptionPayment] Unexpected error:", err);
    throw err;
  }
}
