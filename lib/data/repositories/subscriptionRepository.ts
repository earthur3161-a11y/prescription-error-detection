import { supabase } from "../../supabase/client";
import type { SubscriptionPaymentStatus, SubscriptionProduct, SubscriptionStatus } from "../../supabase/types";

export interface MySubscription {
  product: SubscriptionProduct;
  status: SubscriptionStatus;
  periodEnd: string | null;
  daysRemaining: number;
  /**
   * status === 'active' AND period_end > now(), computed by the RPC itself
   * (0022_restore_subscription_enforcement.sql) — the one field every
   * caller should actually gate access on. `status` alone can go stale:
   * nothing in this codebase ever revisits a row once period_end passes,
   * so a lapsed subscription reads status: "active" forever otherwise.
   */
  isActive: boolean;
}

export async function getMySubscriptionStatus(product: SubscriptionProduct): Promise<MySubscription> {
  const { data, error } = await supabase.rpc("get_my_subscription_status");
  if (error) throw error;
  const row = (data ?? []).find((r) => r.product === product);
  return {
    product,
    status: row?.status ?? "inactive",
    periodEnd: row?.period_end ?? null,
    daysRemaining: row?.days_remaining ?? 0,
    isActive: row?.is_active ?? false,
  };
}

export async function initiateSubscriptionPayment(params: {
  phone: string;
  provider: "mtn" | "vod" | "atl";
}): Promise<{ reference: string; displayMessage: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("You need to be signed in to subscribe.");

  try {
    const res = await fetch("/api/subscriptions/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.json();

    if (!res.ok) {
      const errorMessage = body.message ?? "Couldn't start the payment.";
      const reference = body.reference;

      if (res.status === 409) {
        if (reference) {
          throw new Error(`Payment already in progress. Reference: ${reference}`);
        }
        throw new Error(errorMessage);
      }

      throw new Error(errorMessage);
    }

    return body;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("abort")) {
      throw new Error("Payment request timed out. Please check your connection and try again.");
    }
    throw err;
  }
}

/**
 * Reads the payment's own status (not the subscription's) — the
 * subscriptions row is only ever touched on success, so a failed/abandoned/
 * reversed charge leaves it unchanged forever; polling subscription status
 * alone can never distinguish "still pending" from "definitively failed."
 *
 * Goes through /api/subscriptions/verify rather than a direct table read:
 * that route re-checks with Paystack itself whenever the row is still
 * "pending," instead of trusting only the webhook to ever have told us —
 * see that route's own header for why (every subscription_payments row in
 * this project's history was found stuck on "pending", including at least
 * one confirmed real charge). This is what makes the existing 3-second
 * polling loop self-healing instead of polling a value nothing ever updates.
 */
export async function getSubscriptionPaymentStatus(
  reference: string
): Promise<{ status: SubscriptionPaymentStatus }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("You need to be signed in to check payment status.");

  try {
    const res = await fetch("/api/subscriptions/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ reference }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();

    if (!res.ok) {
      throw new Error(body.message ?? "Couldn't check payment status.");
    }

    if (!body.status || !["pending", "success", "failed"].includes(body.status)) {
      throw new Error("Invalid payment status received from server.");
    }

    return { status: body.status };
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("abort")) {
      throw new Error("Payment status check timed out. Please try again.");
    }
    throw err;
  }
}

/**
 * Finds a still-pending payment for this product that the caller already
 * started, if any — lets billing/page.tsx resume polling/self-healing after
 * a refresh or a fresh sign-in, instead of only ever tracking the reference
 * from the in-memory state of the exact tab that called initiate(). A plain
 * RLS-scoped select (subscription_payments_select_own, owner_id =
 * auth.uid()) is enough here, same as this always was before the change
 * above — this one only ever reads the caller's own rows, nothing to
 * reconcile with Paystack.
 */
export async function findPendingSubscriptionPayment(product: SubscriptionProduct): Promise<string | null> {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("provider_reference")
    .eq("product", product)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.provider_reference ?? null;
}
