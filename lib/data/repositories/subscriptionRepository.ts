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

  const res = await fetch("/api/subscriptions/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Couldn't start the payment.");
  return body;
}

/**
 * Reads the payment's own status directly (not the subscription's) — the
 * subscriptions row is only ever touched by the webhook on success
 * (0006_subscriptions.sql), so a failed/abandoned/reversed charge leaves it
 * unchanged forever. Polling subscription status alone can never
 * distinguish "still pending" from "definitively failed"; this is what
 * makes that distinction visible to the client. A plain RLS-scoped select
 * (subscription_payments_select_own, owner_id = auth.uid()) is enough here
 * — unlike check_payments' get_payment_status RPC, this table is never
 * read by an unauthenticated caller, so no SECURITY DEFINER function is
 * needed to safely expose it.
 */
export async function getSubscriptionPaymentStatus(
  reference: string
): Promise<{ status: SubscriptionPaymentStatus }> {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("status")
    .eq("provider_reference", reference)
    .maybeSingle();
  if (error) throw error;
  return { status: data?.status ?? "pending" };
}
