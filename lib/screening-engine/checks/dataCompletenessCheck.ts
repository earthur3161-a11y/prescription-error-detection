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

  return flags;
}
