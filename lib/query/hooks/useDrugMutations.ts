"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkUpsertDrugs, deleteDrug, upsertDrug } from "../../data/repositories/drugRepository";
import { useToastStore } from "../../store/toast-store";

function invalidateFormulary(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["formulary"] });
  queryClient.invalidateQueries({ queryKey: ["drugSearch"] });
}

export function useUpsertDrug() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: upsertDrug,
    onSuccess: (drug) => {
      invalidateFormulary(queryClient);
      showToast({ title: `${drug.generic_name} saved to formulary`, variant: "success" });
    },
  });
}

export function useBulkUpsertDrugs() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: bulkUpsertDrugs,
    onSuccess: (count) => {
      invalidateFormulary(queryClient);
      showToast({
        title: `${count} drug${count === 1 ? "" : "s"} published to the formulary`,
        variant: "success",
      });
    },
  });
}

export function useDeleteDrug() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: deleteDrug,
    onSuccess: () => {
      invalidateFormulary(queryClient);
      showToast({ title: "Drug removed from formulary", variant: "default" });
    },
  });
}
