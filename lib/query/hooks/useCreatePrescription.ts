"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPrescription } from "../../data/repositories/prescriptionRepository";
import { enqueueOutboxItem } from "../../data/repositories/outboxRepository";
import { runAdminCheckpoint } from "../../pipeline/adminCheckpoint";
import { useOfflineStore } from "../../store/offline-store";
import { useToastStore } from "../../store/toast-store";
import type { Prescription } from "../../types";

/**
 * Every doctor-authored ("hospital" source) prescription is routed through
 * the Facility Admin screening checkpoint the moment it's created — this is
 * not a step the doctor's flow can skip. Walk-in and patient-submitted
 * prescriptions are already pharmacist-initiated intake, so they proceed
 * straight to the pharmacist queue as before.
 */
export function useCreatePrescription() {
  const queryClient = useQueryClient();
  const simulateOffline = useOfflineStore((s) => s.simulateOffline);
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: async (prescription: Prescription) => {
      if (prescription.source === "hospital") {
        const pending = { ...prescription, status: "pending_admin_review" as const };
        await createPrescription(pending);
        const resolved = await runAdminCheckpoint(pending);
        if (simulateOffline) {
          await enqueueOutboxItem("prescription", resolved.id);
        }
        return resolved;
      }

      const created = await createPrescription(prescription);
      if (simulateOffline) {
        await enqueueOutboxItem("prescription", created.id);
      }
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      queryClient.invalidateQueries({ queryKey: ["clinicalAlerts"] });
      const idLabel = created.id.replace("rx_", "");
      const description = simulateOffline
        ? "Saved locally — will sync when back online."
        : created.status === "pending_admin_cosign"
          ? `Prescription ${idLabel} held at the Facility Admin checkpoint — a blocked risk needs co-sign before it reaches the pharmacy.`
          : created.status === "submitted"
            ? `Prescription ${idLabel} cleared the Facility Admin checkpoint and was sent for pharmacist verification.`
            : `Prescription ${idLabel} sent for pharmacist verification.`;
      showToast({
        title: created.status === "pending_admin_cosign" ? "Held for Admin co-sign" : "Prescription submitted",
        description,
        variant: created.status === "pending_admin_cosign" ? "warning" : "success",
      });
    },
  });
}
