import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Flags an incomplete prescription line — a missing required field is called
 * out explicitly (with the specific field named) rather than being guessed or
 * silently passed. Distinct from patient data completeness: this is about the
 * prescription itself.
 */
export function checkPrescriptionCompleteness(input: ScreeningInput): Flag[] {
  const { drugLine, formulary } = input;
  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  const name = drug?.generic_name ?? "this medicine";
  const flags: Flag[] = [];

  const missing = (field: string, code: string) =>
    buildFlag({
      type: "missing_information",
      code,
      severity: "moderate",
      clinical: `Prescription is missing the ${field} for ${name} — required before it can be safely dispensed. Missing field: ${field}.`,
      patient: `Some details are missing for ${name} (${field}) — your pharmacist will need to confirm this.`,
      relatedDrugId: drug?.id,
    });

  if (!(drugLine.strengthMg > 0)) flags.push(missing("strength", "MISSING_STRENGTH"));
  if (!(drugLine.doseMg > 0)) flags.push(missing("dose", "MISSING_DOSE"));
  if (!(drugLine.frequencyPerDay > 0)) flags.push(missing("frequency", "MISSING_FREQUENCY"));
  if (!(drugLine.durationDays > 0)) flags.push(missing("duration", "MISSING_DURATION"));
  if (!drugLine.route) flags.push(missing("route", "MISSING_ROUTE"));

  return flags;
}
