"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  appendErrorLog,
  getIntegrationConfig,
  recordSync,
  regenerateApiKey,
  updateIntegrationConfig,
} from "../../data/repositories/integrationConfigRepository";
import { useToastStore } from "../../store/toast-store";

export function useIntegrationConfig() {
  return useQuery({
    queryKey: ["integrationConfig"],
    queryFn: getIntegrationConfig,
  });
}

export function useUpdateIntegrationConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateIntegrationConfig,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrationConfig"] }),
  });
}

export function useRegenerateApiKey() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: regenerateApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrationConfig"] });
      showToast({ title: "API key regenerated", description: "The old key will stop working immediately.", variant: "warning" });
    },
  });
}

export function useRecordSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: recordSync,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrationConfig"] }),
  });
}

export function useAppendErrorLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appendErrorLog,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrationConfig"] }),
  });
}
