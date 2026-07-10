import { screenDrugLine } from "../../screening-engine";
import type { FormularyBundle, Patient, PatientCheck, PrescriptionDrugLine } from "../../types";
import { generateId } from "../../utils/id";

/**
 * A demo Patient Self-Check submission — an anonymous patient bought
 * Ciprofloxacin over the counter, ran a self-check, and shared the result
 * with a pharmacy. Used to demonstrate the "patient-submitted" intake path
 * in the Pharmacist Verification queue.
 */
export function buildSeedPatientChecks(formulary: FormularyBundle): PatientCheck[] {
  const profile = {
    ageYears: 34,
    weightKg: 60,
    allergies: [] as Patient["allergies"],
    activeMedications: [{ drugId: "drug_warfarin", startedAt: "2026-05-01" }],
  };

  const syntheticPatient: Patient = {
    id: "patient_check_anonymous",
    name: "Self-check patient",
    dob: `${new Date().getFullYear() - profile.ageYears}-01-01`,
    sex: "other",
    weightKg: profile.weightKg,
    renalStatus: "unknown",
    hepaticStatus: "unknown",
    allergies: profile.allergies,
    activeMedications: profile.activeMedications,
  };

  const lines: PrescriptionDrugLine[] = [
    {
      id: "line_check_1",
      drugId: "drug_ciprofloxacin",
      form: "tablet",
      strengthMg: 500,
      route: "oral",
      doseMg: 500,
      frequencyPerDay: 2,
      durationDays: 5,
    },
  ];

  const verdicts = lines.map((line) =>
    screenDrugLine({ patient: syntheticPatient, drugLine: line, otherLines: lines, formulary })
  );

  return [
    {
      id: "check_demo_1",
      createdAt: "2026-07-02T10:00:00.000Z",
      drugs: lines,
      profile,
      verdicts,
      shareToken: generateId("share"),
    },
  ];
}
