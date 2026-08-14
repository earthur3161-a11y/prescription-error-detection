"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  findPendingCheckPayment,
  getCheckQuota,
  getPaymentStatus,
  initiatePayment,
} from "../../data/repositories/checkQuotaRepository";

export function useCheckQuota(phone: string | null) {
  return useQuery({
    queryKey: ["checkQuota", phone],
    queryFn: () => getCheckQuota(phone as string),
    enabled: !!phone,
  });
}

export function useInitiatePayment() {
  return useMutation({
    mutationFn: initiatePayment,
  });
}

/** Polls until the Mobile Money payment resolves, then stops. */
export function usePaymentStatus(reference: string | null) {
  return useQuery({
    queryKey: ["paymentStatus", reference],
    queryFn: () => getPaymentStatus(reference as string),
    enabled: !!reference,
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 3000 : false),
  });
}

/**
 * One-shot lookup (not polled) for a payment this phone already started in a
 * previous page load — lets UnlockCheckStep resume tracking/self-healing a
 * payment after a reload instead of only ever knowing about the reference
 * held in that one mount's own state.
 */
export function useFindPendingCheckPayment(phone: string | null) {
  return useQuery({
    queryKey: ["pendingCheckPayment", phone],
    queryFn: () => findPendingCheckPayment(phone as string),
    enabled: !!phone,
    staleTime: Infinity,
  });
}
