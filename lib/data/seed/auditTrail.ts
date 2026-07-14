import type { PharmacistAction } from "../../types";
import { seedUsers } from "./users";

// Demo dispensing decisions that reference the seed prescriptions in
// ./prescriptions.ts, so the Audit & Compliance Center's "decision" category
// is populated on first load rather than only screenings and overrides.

const pharmacist = seedUsers.find((u) => u.role === "pharmacist")!;

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
