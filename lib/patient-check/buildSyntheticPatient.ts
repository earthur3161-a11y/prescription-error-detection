import type { Patient, PatientCheckProfile } from "../types";

/**
 * The screening engine only knows how to screen against a `Patient` record.
 * Patient Self-Check has no registered patient — this adapts the profile
 * the user typed in (or left unknown) into the same shape, so the exact
 * same engine runs for anonymous patients as for clinical patients.
 */
export function buildSyntheticPatient(profile: PatientCheckProfile): Patient {
  const currentYear = new Date().getFullYear();
  const birthYear = profile.ageYears !== null ? currentYear - profile.ageYears : currentYear - 30;

  return {
    id: "patient_check_synthetic",
    name: "You",
    dob: `${birthYear}-01-01`,
    sex: "other",
    weightKg: profile.weightKg,
    renalStatus: profile.renalStatus,
    hepaticStatus: profile.hepaticStatus,
    allergies: profile.allergies,
    activeMedications: profile.activeMedications,
    isPregnant: profile.isPregnant,
    reportedConditions: profile.reportedConditions,
  };
}
