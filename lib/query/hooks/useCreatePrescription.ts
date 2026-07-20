"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPrescription } from "../../data/repositories/prescriptionRepository";
import { enqueueOutboxItem } from "../../data/repositories/outboxRepository";
import { useOfflineStore } from "../../store/offline-store";
import { useToastStore } from "../../store/toast-store";
import type { Prescription } from "../../types";

export function useCreatePrescription() {
  const queryClient = useQueryClient();
  const simulateOffline = useOfflineStore((s) => s.simulateOffline);
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: async (prescription: Prescription) => {
      const created = await createPrescription(prescription);
      if (simulateOffline) {
        await enqueueOutboxItem("prescription", created.id);
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      const idLabel = created.id.slice(0, 8);
      showToast({
        title: "Prescription submitted",
        description: simulateOffline
          ? "Saved locally — will sync when back online."
          : `Prescription ${idLabel} saved.`,
        variant: "success",
      });
    },
  });
}
