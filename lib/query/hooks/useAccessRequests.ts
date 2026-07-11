"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveAccessRequest,
  createAccessRequest,
  getLatestAccessRequestByEmail,
  listAccessRequests,
  rejectAccessRequest,
} from "../../data/repositories/accessRequestRepository";
import { useToastStore } from "../../store/toast-store";

export function useAccessRequests() {
  return useQuery({ queryKey: ["accessRequests"], queryFn: listAccessRequests });
}

export function useAccessRequestStatus(email: string) {
  return useQuery({
    queryKey: ["accessRequestStatus", email.trim().toLowerCase()],
    queryFn: () => getLatestAccessRequestByEmail(email),
    enabled: email.trim().length > 0,
  });
}

export function useCreateAccessRequest() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: createAccessRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessRequests"] });
      showToast({ title: "Request submitted", description: "We'll review it and be in touch.", variant: "success" });
    },
  });
}

export function useApproveAccessRequest() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: approveAccessRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessRequests"] });
      showToast({ title: "Approved", description: "An invite email has been sent.", variant: "success" });
    },
    onError: (error: Error) => {
      showToast({ title: "Couldn't approve", description: error.message, variant: "error" });
    },
  });
}

export function useRejectAccessRequest() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectAccessRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accessRequests"] });
      showToast({ title: "Request rejected", variant: "default" });
    },
  });
}
