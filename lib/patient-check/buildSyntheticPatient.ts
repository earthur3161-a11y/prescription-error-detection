import type { Patient, PatientCheckProfile } from "../types";

/**
 * The screening engine only knows how to screen against a `Patient` record.
 * Patient Self-Check has no registered patient — this adapts the profile
 * the user typed in (or left unknown) into the same shape, so the exact
 * same engine runs for anonymous patients as for clinical patients.
 */
export function buildSyntheticPatient(profile: PatientCheckProfile): Patient {
  const currentYear = new Date().getFullYear();
  // Age left blank: ageYearsUnknown tells every age-dependent check to flag
  // age as unknown rather than trust a derived dob. The placeholder dob below
  // is never meant to be interpreted as real when that flag is set — it only
  // exists because `dob` itself isn't nullable (every real, persisted patient
  // record always has a confirmed one; only this synthetic self-check patient
  // can lack one, so the "unknown" state is carried by the flag, not by dob).
  const ageYearsUnknown = profile.ageYears === null;
  const birthYear = ageYearsUnknown ? currentYear - 30 : currentYear - profile.ageYears!;

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
    ageYearsUnknown,
  };
}
