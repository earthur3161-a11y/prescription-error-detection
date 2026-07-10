import type { ClinicalAlert, PharmacistAction, PipelineEvent } from "../../types";
import { seedUsers } from "./users";

// Demo alerts / decisions that reference the seed prescriptions in
// ./prescriptions.ts, so the Audit & Compliance Center shows all three record
// categories (check, alert, decision) populated on first load rather than only
// screenings and overrides.

const prescriber = seedUsers.find((u) => u.role === "prescriber")!;
const pharmacist = seedUsers.find((u) => u.role === "pharmacist")!;
const admin = seedUsers.find((u) => u.role === "admin")!;

export function buildSeedClinicalAlerts(): ClinicalAlert[] {
  return [
    {
      id: "alert_abena_1",
      prescriptionId: "rx_abena_1",
      prescriberId: prescriber.id,
      verdict: "blocked",
      requiresCosign: true,
      message:
        "Blocked: severe penicillin allergy conflict on Amoxicillin. Requires Facility Admin co-sign before it can reach the pharmacy queue.",
      status: "pending_cosign",
      createdAt: "2026-07-01T14:06:00.000Z",
    },
    {
      id: "alert_kojo_1",
      prescriptionId: "rx_kojo_1",
      prescriberId: prescriber.id,
      verdict: "caution",
      requiresCosign: false,
      message: "Caution: moderate Ciprofloxacin–Warfarin interaction. Prescriber acknowledged and overrode.",
      status: "acknowledged",
      createdAt: "2026-06-29T11:41:00.000Z",
      resolvedAt: "2026-06-29T11:42:30.000Z",
      resolvedBy: prescriber.id,
    },
  ];
}

export function buildSeedPipelineEvents(): PipelineEvent[] {
  return [
    {
      id: "pev_kojo_cleared",
      prescriptionId: "rx_kojo_1",
      type: "admin_checkpoint_cleared",
      note: "Cleared to the pharmacy queue after the prescriber logged an override.",
      userId: admin.id,
      timestamp: "2026-06-29T11:45:00.000Z",
    },
    {
      id: "pev_abena_held",
      prescriptionId: "rx_abena_1",
      type: "admin_checkpoint_held_for_cosign",
      note: "Held at the checkpoint: blocked allergy line needs co-sign.",
      userId: admin.id,
      timestamp: "2026-07-01T14:07:00.000Z",
    },
  ];
}

export function buildSeedPharmacistActions(): PharmacistAction[] {
  return [
    {
      id: "pact_kwabena_approve",
      prescriptionId: "rx_kwabena_1",
      pharmacistId: pharmacist.id,
      action: "approve",
      reason: "No safety flags; patient identity and dose confirmed.",
      timestamp: "2026-06-28T09:20:00.000Z",
    },
    {
      id: "pact_kwabena_dispense",
      prescriptionId: "rx_kwabena_1",
      pharmacistId: pharmacist.id,
      action: "dispense",
      reason: "Full quantity dispensed from batch PCM-2411.",
      timestamp: "2026-06-28T09:25:00.000Z",
    },
    {
      id: "pact_yaw_hold",
      prescriptionId: "rx_yaw_1",
      pharmacistId: pharmacist.id,
      action: "hold",
      reason: "Awaiting confirmation of the external prescriber's registration number.",
      timestamp: "2026-07-02T08:30:00.000Z",
    },
  ];
}
