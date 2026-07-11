"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePrescriptionStatus } from "../../data/repositories/prescriptionRepository";
import { resolveClinicalAlert } from "../../data/repositories/clinicalAlertRepository";
import { appendPipelineEvent } from "../../data/repositories/pipelineEventRepository";
import { useToastStore } from "../../store/toast-store";

interface CosignInput {
  prescriptionId: string;
  /**
   * The clinical alert is still Dexie-only (per-browser), while
   * prescription.status is now shared via Postgres — so a device other than
   * the one that ran the Admin checkpoint won't have a local alert row to
   * resolve, even though the prescription genuinely is awaiting co-sign.
   * Optional here so the action itself never depends on data that may not
   * exist on this device; when present it's still resolved for the alert
   * list on the device that does have it.
   */
  alertId?: string;
  adminId: string;
}

/** Facility Admin co-signs a checkpoint-held prescription, releasing it to the pharmacist queue. */
export function useCosignPrescription() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: async ({ prescriptionId, alertId, adminId }: CosignInput) => {
      await updatePrescriptionStatus(prescriptionId, "submitted");
      if (alertId) await resolveClinicalAlert(alertId, "cosigned", adminId);
      await appendPipelineEvent({
        prescriptionId,
        type: "admin_cosigned",
        userId: adminId,
        note: "Facility Admin co-signed the blocked verdict; released to the pharmacist queue.",
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["prescription", variables.prescriptionId] });
      queryClient.invalidateQueries({ queryKey: ["clinicalAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["pipelineEvents", variables.prescriptionId] });
      showToast({ title: "Co-signed", description: "Released to the pharmacist queue.", variant: "success" });
    },
  });
}

interface SendBackInput {
  prescriptionId: string;
  /** See the comment on CosignInput.alertId — same cross-device reasoning applies here. */
  alertId?: string;
  adminId: string;
  note: string;
}

/** Facility Admin sends a checkpoint-held prescription back to the prescriber instead of co-signing it. */
export function useSendBackToDoctor() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: async ({ prescriptionId, alertId, adminId, note }: SendBackInput) => {
      await updatePrescriptionStatus(prescriptionId, "flagged", undefined, note);
      if (alertId) await resolveClinicalAlert(alertId, "sent_back", adminId);
      await appendPipelineEvent({
        prescriptionId,
        type: "admin_sent_back",
        userId: adminId,
        note,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["prescription", variables.prescriptionId] });
      queryClient.invalidateQueries({ queryKey: ["clinicalAlerts"] });
      queryClient.invalidateQueries({ queryKey: ["pipelineEvents", variables.prescriptionId] });
      showToast({ title: "Sent back to prescriber", variant: "warning" });
    },
  });
}
