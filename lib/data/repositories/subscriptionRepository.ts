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
}): Promise<{ reference: string; displayMessage: string; authorizationUrl?: string; awaitingOtp?: boolean }> {
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
      // A 409 with a reference means the caller already has a live payment
      // in flight (the 5-minute idempotency guard in the route) — that's
      // not really a failure to report, it's the exact same payment this
      // call would otherwise have just resumed. Returning it through the
      // normal success shape lets the caller (handlePay's onSuccess) pick
      // back up on that live charge/OTP screen instead of dead-ending on a
      // toast the user has no way to act on.
      if (res.status === 409 && body.reference) {
        return {
          reference: body.reference,
          awaitingOtp: !!body.awaitingOtp,
          displayMessage: body.message ?? "A payment is already in progress.",
        };
      }
      throw new Error(body.message ?? "Couldn't start the payment.");
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
 * Relays the OTP the customer received (Paystack's "send_otp" Mobile Money
 * flow — see lib/payments/paystackCharge.ts) back to Paystack via
 * /api/subscriptions/submit-otp. Doesn't resolve the payment itself; the
 * existing getSubscriptionPaymentStatus poll picks up the outcome once
 * Paystack processes it.
 */
export async function submitSubscriptionOtp(params: { reference: string; otp: string }): Promise<{ ok: boolean; message: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("You need to be signed in to submit this code.");

  try {
    const res = await fetch("/api/subscriptions/submit-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message ?? "Couldn't submit the code.");
    return body;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("abort")) {
      throw new Error("Submitting the code timed out. Please try again.");
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
export async function findPendingSubscriptionPayment(
  product: SubscriptionProduct
): Promise<{ reference: string; awaitingOtp: boolean } | null> {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("provider_reference, awaiting_otp")
    .eq("product", product)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { reference: data.provider_reference, awaitingOtp: data.awaiting_otp };
}
