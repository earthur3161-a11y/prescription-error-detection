import { supabase } from "../../supabase/client";
import type { SubscriptionProduct, SubscriptionStatus } from "../../supabase/types";

export interface MySubscription {
  product: SubscriptionProduct;
  status: SubscriptionStatus;
  periodEnd: string | null;
  daysRemaining: number;
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
