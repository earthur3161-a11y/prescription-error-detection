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

export async function getPaymentStatus(reference: string): Promise<{ status: "pending" | "success" | "failed" }> {
  const { data, error } = await supabase.rpc("get_payment_status", { p_reference: reference });
  if (error) throw error;
  return { status: data?.[0]?.status ?? "pending" };
}
