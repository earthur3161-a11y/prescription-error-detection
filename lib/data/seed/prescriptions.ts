import { screenDrugLine } from "../../screening-engine";
import type {
  FormularyBundle,
  OverrideLog,
  Prescription,
  PrescriptionDrugLine,
} from "../../types";
import { seedPatients } from "./patients";
import { seedUsers } from "./users";

const prescriber = seedUsers.find((u) => u.role === "prescriber")!;

function screenAll(
  patientId: string,
  lines: PrescriptionDrugLine[],
  formulary: FormularyBundle
) {
  const patient = seedPatients.find((p) => p.id === patientId) ?? null;
  return lines.map((line) =>
    screenDrugLine({
      patient,
      drugLine: line,
      otherLines: lines,
      formulary,
    })
  );
}

export function buildSeedData(formulary: FormularyBundle): {
  prescriptions: Prescription[];
  overrideLogs: OverrideLog[];
} {
  const prescriptions: Prescription[] = [];
  const overrideLogs: OverrideLog[] = [];

  // 1. Safe, already dispensed.
  const rx1Lines: PrescriptionDrugLine[] = [
    {
      id: "line_rx1_1",
      drugId: "drug_paracetamol",
      form: "tablet",
      strengthMg: 500,
      route: "oral",
      doseMg: 500,
      frequencyPerDay: 3,
      durationDays: 5,
    },
  ];
  prescriptions.push({
    id: "rx_kwabena_1",
    patientId: "patient_kwabena_owusu",
    prescriberId: prescriber.id,
    drugs: rx1Lines,
    verdicts: screenAll("patient_kwabena_owusu", rx1Lines, formulary),
    status: "dispensed",
    createdAt: "2026-06-28T09:15:00.000Z",
    source: "physician",
  });

  // 2. Caution (interaction with warfarin), overridden, verified by pharmacist.
  const rx2Lines: PrescriptionDrugLine[] = [
    {
      id: "line_rx2_1",
      drugId: "drug_ciprofloxacin",
      form: "tablet",
      strengthMg: 500,
      route: "oral",
      doseMg: 500,
      frequencyPerDay: 2,
      durationDays: 7,
    },
  ];
  prescriptions.push({
    id: "rx_kojo_1",
    patientId: "patient_kojo_asante",
    prescriberId: prescriber.id,
    drugs: rx2Lines,
    verdicts: screenAll("patient_kojo_asante", rx2Lines, formulary),
    status: "verified",
    createdAt: "2026-06-29T11:40:00.000Z",
    source: "physician",
  });
  overrideLogs.push({
    id: "ovr_kojo_1",
    prescriptionId: "rx_kojo_1",
    drugId: "drug_ciprofloxacin",
    verdictOverridden: "caution",
    reasonCode: "verified_with_pharmacist",
    reasonText: "INR to be monitored twice weekly during course; pharmacist counseled patient.",
    userId: prescriber.id,
    timestamp: "2026-06-29T11:42:00.000Z",
  });

  // 3. Blocked (severe penicillin allergy), overridden, awaiting pharmacist review.
  const rx3Lines: PrescriptionDrugLine[] = [
    {
      id: "line_rx3_1",
      drugId: "drug_amoxicillin",
      form: "capsule",
      strengthMg: 500,
      route: "oral",
      doseMg: 500,
      frequencyPerDay: 3,
      durationDays: 7,
    },
  ];
  prescriptions.push({
    id: "rx_abena_1",
    patientId: "patient_abena_sarpong",
    prescriberId: prescriber.id,
    drugs: rx3Lines,
    verdicts: screenAll("patient_abena_sarpong", rx3Lines, formulary),
    status: "submitted",
    createdAt: "2026-07-01T14:05:00.000Z",
    source: "physician",
  });
  overrideLogs.push({
    id: "ovr_abena_1",
    prescriptionId: "rx_abena_1",
    drugId: "drug_amoxicillin",
    verdictOverridden: "blocked",
    reasonCode: "other",
    reasonText:
      "Re-tested patient's penicillin allergy status with skin test on 2026-06-30, negative. Proceeding under allergist supervision.",
    userId: prescriber.id,
    timestamp: "2026-07-01T14:08:00.000Z",
  });

  // 4. Safe, awaiting pharmacist review (no overrides).
  const rx4Lines: PrescriptionDrugLine[] = [
    {
      id: "line_rx4_1",
      drugId: "drug_amlodipine",
      form: "tablet",
      strengthMg: 5,
      route: "oral",
      doseMg: 5,
      frequencyPerDay: 1,
      durationDays: 30,
    },
  ];
  prescriptions.push({
    id: "rx_yaw_1",
    patientId: "patient_yaw_boadi",
    prescriberId: prescriber.id,
    drugs: rx4Lines,
    verdicts: screenAll("patient_yaw_boadi", rx4Lines, formulary),
    status: "submitted",
    createdAt: "2026-07-02T08:20:00.000Z",
    source: "walk_in",
    externalPrescriberName: "Dr. Nana Yeboah (Ridge Hospital, external)",
  });

  // 5. Patient-submitted — a patient ran a Self-Check and shared it with the pharmacy.
  const rx5Lines: PrescriptionDrugLine[] = [
    {
      id: "line_rx5_1",
      drugId: "drug_ciprofloxacin",
      form: "tablet",
      strengthMg: 500,
      route: "oral",
      doseMg: 500,
      frequencyPerDay: 2,
      durationDays: 5,
    },
  ];
  prescriptions.push({
    id: "rx_patient_check_1",
    patientId: "patient_kojo_asante",
    prescriberId: prescriber.id,
    drugs: rx5Lines,
    verdicts: screenAll("patient_kojo_asante", rx5Lines, formulary),
    status: "submitted",
    createdAt: "2026-07-02T10:05:00.000Z",
    source: "patient_submitted",
    patientCheckId: "check_demo_1",
  });

  return { prescriptions, overrideLogs };
}
