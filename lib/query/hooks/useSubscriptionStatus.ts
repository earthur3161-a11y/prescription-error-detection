"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  findPendingSubscriptionPayment,
  getMySubscriptionStatus,
  getSubscriptionPaymentStatus,
  initiateSubscriptionPayment,
  submitSubscriptionOtp,
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

export function useSubmitSubscriptionOtp() {
  return useMutation({ mutationFn: submitSubscriptionOtp });
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

/**
 * One-shot lookup (not polled) for a payment the caller already started in
 * a previous page load — lets billing/page.tsx resume tracking/self-healing
 * a payment after a refresh instead of only ever knowing about the
 * reference held in that one tab's own component state.
 */
export function useFindPendingSubscriptionPayment(product: SubscriptionProduct | null) {
  return useQuery({
    queryKey: ["pendingSubscriptionPayment", product],
    queryFn: () => findPendingSubscriptionPayment(product as SubscriptionProduct),
    enabled: !!product,
    staleTime: Infinity,
  });
}
