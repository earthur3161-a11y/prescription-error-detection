"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyInstitution,
  listMyApiKeys,
  mintApiKey,
  revokeApiKey,
  updateMyEnforcementLevel,
} from "../../data/repositories/institutionRepository";
import { useToastStore } from "../../store/toast-store";
import type { ApiKeyMode } from "../../types";

export function useMyInstitution() {
  return useQuery({ queryKey: ["institution"], queryFn: getMyInstitution });
}

export function useMyApiKeys() {
  return useQuery({ queryKey: ["institutionApiKeys"], queryFn: listMyApiKeys });
}

export function useMintApiKey(institutionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: ApiKeyMode) => {
      if (!institutionId) throw new Error("No institution found for this account.");
      return mintApiKey(institutionId, mode);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["institutionApiKeys"] }),
  });
}

export function useRevokeApiKey(institutionId: string | undefined) {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: (keyId: string) => {
      if (!institutionId) throw new Error("No institution found for this account.");
      return revokeApiKey(institutionId, keyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institutionApiKeys"] });
      showToast({ title: "Key revoked", description: "It will stop working immediately.", variant: "warning" });
    },
  });
}

export function useUpdateMyEnforcementLevel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMyEnforcementLevel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["institution"] }),
  });
}
