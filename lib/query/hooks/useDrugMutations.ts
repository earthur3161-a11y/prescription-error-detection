"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkUpsertDrugs, deleteDrug, upsertDrug } from "../../data/repositories/drugRepository";
import { useToastStore } from "../../store/toast-store";
import type { Drug } from "../../types";

function invalidateFormulary(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["formulary"] });
  queryClient.invalidateQueries({ queryKey: ["drugSearch"] });
}

export function useUpsertDrug() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: (vars: { drug: Drug; institutionId: string | null }) => upsertDrug(vars.drug, vars.institutionId),
    onSuccess: (drug) => {
      invalidateFormulary(queryClient);
      showToast({ title: `${drug.generic_name} saved to formulary`, variant: "success" });
    },
    onError: (err: Error) => showToast({ title: "Couldn't save this drug", description: err.message, variant: "error" }),
  });
}

export function useBulkUpsertDrugs() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: (vars: { drugs: Drug[]; institutionId: string | null }) => bulkUpsertDrugs(vars.drugs, vars.institutionId),
    onSuccess: (count) => {
      invalidateFormulary(queryClient);
      showToast({
        title: `${count} drug${count === 1 ? "" : "s"} published to the formulary`,
        variant: "success",
      });
    },
    onError: (err: Error) => showToast({ title: "Couldn't publish these drugs", description: err.message, variant: "error" }),
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
    onError: (err: Error) => showToast({ title: "Couldn't remove this drug", description: err.message, variant: "error" }),
  });
}
