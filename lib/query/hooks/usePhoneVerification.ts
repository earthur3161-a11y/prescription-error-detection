"use client";

import { useMutation } from "@tanstack/react-query";
import { sendOtp, verifyOtp } from "../../data/repositories/phoneVerificationRepository";

export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) => sendOtp(phone),
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) => verifyOtp(phone, code),
  });
}
