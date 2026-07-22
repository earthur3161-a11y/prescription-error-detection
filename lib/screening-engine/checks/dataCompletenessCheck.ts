import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Patient-level summary flag. The individual checks below also guard their
 * own required fields independently (defense in depth) — this check exists
 * so the UI has one flag to key a persistent "verify manually" banner off of
 * as soon as a patient is loaded, before any drug is even added.
 */
export function checkDataCompleteness(input: ScreeningInput): Flag[] {
  const { patient } = input;
  const flags: Flag[] = [];

  if (!patient) {
    return [
      buildFlag({
        type: "data_incomplete",
        code: "PATIENT_NOT_SELECTED",
        severity: "unknown",
        clinical: "No patient selected — screening cannot be performed.",
        patient: "We need a bit more information before we can check this for you.",
      }),
    ];
  }

  if (patient.allergies === null) {
    flags.push(
      buildFlag({
        type: "data_incomplete",
        code: "ALLERGY_DATA_UNKNOWN",
        severity: "unknown",
        clinical: "Allergy data incomplete — verify manually before prescribing.",
        patient: "We don't have your allergy history — please double-check with your pharmacist.",
      })
    );
  }

  if (patient.activeMedications === null) {
    flags.push(
      buildFlag({
        type: "data_incomplete",
        code: "MEDICATION_DATA_UNKNOWN",
        severity: "unknown",
        clinical: "Current medication list incomplete — verify manually before prescribing.",
        patient: "We don't know what else you're taking — please double-check with your pharmacist.",
      })
    );
  }

  if (patient.weightKg === null) {
    flags.push(
      buildFlag({
        type: "data_incomplete",
        code: "WEIGHT_DATA_UNKNOWN",
        severity: "unknown",
        clinical: "Patient weight not on file — weight-based dosing cannot be fully verified.",
        patient: "We don't have your weight, so we can't fully check if this dose is right for you.",
      })
    );
  }

  // The four checks below close the same gap the three above already guard:
  // "unknown" must never resolve the same way as "confirmed normal/negative."
  // These are patient-level, unconditional-on-drug flags for the persistent
  // banner; the drug-specific version (only raised when the current drug
  // actually has renal/hepatic/pregnancy/age-dependent dosing considerations)
  // lives in contraindicationCheck.ts and doseRangeCheck.ts respectively —
  // same defense-in-depth split already used for weight above.

  if (patient.renalStatus === "unknown") {
    flags.push(
      buildFlag({
        type: "data_incomplete",
        code: "RENAL_STATUS_UNKNOWN",
        severity: "unknown",
        clinical: "Renal function status not on file — verify before prescribing renally-cleared or renally-adjusted medicines.",
        patient: "We don't have your kidney function on file — please make sure your pharmacist or doctor knows if you have any kidney problems.",
      })
    );
  }

  if (patient.hepaticStatus === "unknown") {
    flags.push(
      buildFlag({
        type: "data_incomplete",
        code: "HEPATIC_STATUS_UNKNOWN",
        severity: "unknown",
        clinical: "Hepatic function status not on file — verify before prescribing hepatically-cleared or hepatically-adjusted medicines.",
        patient: "We don't have your liver function on file — please make sure your pharmacist or doctor knows if you have any liver problems.",
      })
    );
  }

  if ((patient.isPregnant === null || patient.isPregnant === undefined) && patient.sex !== "male") {
    flags.push(
      buildFlag({
        type: "data_incomplete",
        code: "PREGNANCY_STATUS_UNKNOWN",
        severity: "unknown",
        clinical: "Pregnancy status not on file — verify before prescribing any medicine with pregnancy-related risk.",
        patient: "We don't have your pregnancy status on file — please let your pharmacist or doctor know if there's any chance you could be pregnant.",
      })
    );
  }

  if (patient.ageYearsUnknown) {
    flags.push(
      buildFlag({
        type: "data_incomplete",
        code: "AGE_DATA_UNKNOWN",
        severity: "unknown",
        clinical: "Patient age not on file — pediatric- and geriatric-specific dosing checks cannot be verified.",
        patient: "We don't have your age on file, so we can't fully check pediatric- or age-specific dosing for you.",
      })
    );
  }

  return flags;
}
