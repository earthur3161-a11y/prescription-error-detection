import { supabase } from "../../supabase/client";

export interface CheckQuota {
  freeRemaining: number;
  paidAvailable: number;
  phoneVerified: boolean;
}

export async function getCheckQuota(phone: string): Promise<CheckQuota> {
  const { data, error } = await supabase.rpc("get_check_quota", { p_phone: phone });
  if (error) throw error;
  const row = data?.[0];
  return {
    freeRemaining: row?.free_remaining ?? 0,
    paidAvailable: row?.paid_available ?? 0,
    phoneVerified: row?.phone_verified ?? false,
  };
}

export async function initiatePayment(params: {
  phone: string;
  provider: "mtn" | "vod" | "atl";
}): Promise<{ reference: string; displayMessage: string }> {
  const res = await fetch("/api/payments/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Couldn't start the payment.");
  return body;
}

/**
 * Goes through /api/payments/verify rather than reading check_payments
 * directly (the old get_payment_status RPC): that route re-checks with
 * Paystack itself whenever the row is still "pending", instead of trusting
 * only the webhook to ever have told us — see that route's own header. This
 * is what makes the existing 3-second polling loop in usePaymentStatus
 * self-healing instead of polling a value nothing ever updates.
 */
export async function getPaymentStatus(reference: string): Promise<{ status: "pending" | "success" | "failed" }> {
  const res = await fetch("/api/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Couldn't check payment status.");
  return { status: body.status };
}

/**
 * Finds a still-pending payment for this phone that was already started, if
 * any — lets UnlockCheckStep resume polling/self-healing after a reload
 * instead of only ever tracking the reference held in the tab's own
 * component state (which the multi-step wizard's own state reset already
 * loses on reload regardless). Self-check has no Supabase session to scope
 * an RLS select by, so this goes through a narrow SECURITY DEFINER RPC keyed
 * on phone instead — the same trust model every other self-check RPC
 * already uses (the phone number itself, OTP-verified earlier in the flow,
 * is the credential).
 */
export async function findPendingCheckPayment(phone: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("find_pending_check_payment", { p_phone: phone });
  if (error) throw error;
  return data?.[0]?.provider_reference ?? null;
}
