import type { FormularyBundle, Patient, PrescriptionDrugLine } from "../types";

export type Severity = "none" | "minor" | "moderate" | "major" | "severe" | "unknown";

export type Verdict = "safe" | "caution" | "blocked";

export type FlagType =
  | "allergy"
  | "interaction"
  | "duplicate_therapy"
  | "dose_range" // generic dosing issues (e.g. weight-based dose unverifiable)
  | "wrong_dose"
  | "wrong_frequency"
  | "wrong_duration"
  | "max_daily_dose"
  | "pediatric_geriatric_dosing"
  | "contraindication"
  | "pregnancy_warning"
  | "missing_information"
  | "data_incomplete"
  | "eml_compliance"
  | "indication_mismatch"
  /**
   * The drugId on this line isn't in the formulary at all — none of the
   * other 9 checks can meaningfully run (most require looking the drug up),
   * so this must fail loudly with its own explicit flag rather than let each
   * check silently no-op and let the line resolve as if nothing were wrong.
   */
  | "unrecognized_drug";

/**
 * The same underlying rule produces both a clinical and a plain-language
 * reading of a flag, so the medical logic stays single-sourced while only
 * the language layer adapts per audience (patient vs. pharmacist/prescriber).
 */
export interface AudienceVariant {
  patient: string;
  clinical: string;
}

export interface Flag {
  type: FlagType;
  code: string;
  severity: Severity;
  /** Clinical-register message — kept for backward compatibility with existing clinical UI; equals audience_variant.clinical. */
  message: string;
  audience_variant: AudienceVariant;
  /** Citation/source for clinical detail (e.g. guideline reference), shown in pharmacist/institution views. */
  referenceSource?: string;
  relatedDrugId?: string;
}

export interface DrugLineVerdict {
  drugId: string;
  lineId: string;
  verdict: Verdict;
  flags: Flag[];
  screenedAt: string;
}

export interface ScreeningInput {
  patient: Patient | null;
  drugLine: PrescriptionDrugLine;
  otherLines: PrescriptionDrugLine[];
  formulary: FormularyBundle;
}
