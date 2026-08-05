"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPrescriptionVersion } from "../../data/repositories/prescriptionRepository";
import { useToastStore } from "../../store/toast-store";
import type { DrugLineVerdict, PrescriptionDrugLine, PrescriptionStatus } from "../../types";

export function useCreatePrescriptionVersion() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: (params: {
      editingId: string;
      newId: string;
      drugs: PrescriptionDrugLine[];
      verdicts: DrugLineVerdict[];
      status?: PrescriptionStatus;
    }) =>
      createPrescriptionVersion(params.editingId, params.newId, params.drugs, params.verdicts, params.status),
    onSuccess: (created, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["prescription", variables.editingId] });
      queryClient.invalidateQueries({ queryKey: ["prescription", created.id] });
      showToast({
        title: "New version saved",
        description: `The previous version is preserved — this is version ${created.versionNumber}.`,
        variant: "success",
      });
    },
  });
}
