"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { getCheckQuota, getPaymentStatus, initiatePayment } from "../../data/repositories/checkQuotaRepository";

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
