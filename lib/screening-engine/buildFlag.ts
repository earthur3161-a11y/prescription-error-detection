import type { Flag, FlagType, Severity } from "./types";

interface BuildFlagParams {
  type: FlagType;
  code: string;
  severity: Severity;
  clinical: string;
  patient: string;
  referenceSource?: string;
  relatedDrugId?: string;
}

/** Constructs a Flag with both audience registers from one call site, keeping `message` (clinical UI) and `audience_variant.clinical` in sync by construction. */
export function buildFlag({
  type,
  code,
  severity,
  clinical,
  patient,
  referenceSource,
  relatedDrugId,
}: BuildFlagParams): Flag {
  return {
    type,
    code,
    severity,
    message: clinical,
    audience_variant: { clinical, patient },
    ...(referenceSource ? { referenceSource } : {}),
    ...(relatedDrugId ? { relatedDrugId } : {}),
  };
}
