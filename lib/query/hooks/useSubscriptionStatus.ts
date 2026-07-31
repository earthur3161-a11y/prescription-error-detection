"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getMySubscriptionStatus,
  getSubscriptionPaymentStatus,
  initiateSubscriptionPayment,
} from "../../data/repositories/subscriptionRepository";
import type { SubscriptionProduct } from "../../supabase/types";

/**
 * Polls while a payment is in flight, stopping once the subscription itself
 * flips to active — semantically what the caller actually cares about,
 * rather than a separate payment-row status (no extra RPC needed; the
 * webhook activates `subscriptions` directly on payment confirmation).
 */
export function useSubscriptionStatus(product: SubscriptionProduct | null, polling: boolean) {
  return useQuery({
    queryKey: ["subscriptionStatus", product],
    queryFn: () => getMySubscriptionStatus(product as SubscriptionProduct),
    enabled: !!product,
    refetchInterval: (query) => (polling && !query.state.data?.isActive ? 3000 : false),
  });
}

export function useInitiateSubscriptionPayment() {
  return useMutation({ mutationFn: initiateSubscriptionPayment });
}

/** Polls the payment's own status until it resolves, then stops — same shape/convention as useCheckQuota.ts's usePaymentStatus, over subscription_payments instead of check_payments. */
export function useSubscriptionPaymentStatus(reference: string | null) {
  return useQuery({
    queryKey: ["subscriptionPaymentStatus", reference],
    queryFn: () => getSubscriptionPaymentStatus(reference as string),
    enabled: !!reference,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
  });
}
