"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePrescriptionStatus } from "../../data/repositories/prescriptionRepository";
import { useToastStore } from "../../store/toast-store";
import type { PrescriptionStatus } from "../../types";

export function useUpdatePrescriptionStatus() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: ({
      id,
      status,
      pharmacistNote,
    }: {
      id: string;
      status: PrescriptionStatus;
      pharmacistNote?: string;
    }) => updatePrescriptionStatus(id, status, pharmacistNote),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["prescription", variables.id] });
      showToast({
        title:
          variables.status === "dispensed"
            ? "Prescription dispensed"
            : variables.status === "flagged"
              ? "Flagged back to prescriber"
              : "Status updated",
        variant: variables.status === "flagged" ? "warning" : "success",
      });
    },
  });
}
