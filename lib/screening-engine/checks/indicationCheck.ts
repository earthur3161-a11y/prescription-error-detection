import { buildFlag } from "../buildFlag";
import { CONDITION_TO_DRUG_CLASSES, type PatientCondition } from "../../patient-check/conditions";
import type { Flag, ScreeningInput } from "../types";

function formatList(items: string[]): string {
  if (items.length === 1) return items[0].toLowerCase();
  return `${items.slice(0, -1).join(", ").toLowerCase()} or ${items[items.length - 1].toLowerCase()}`;
}

/**
 * Cross-checks the drug's therapeutic class against the reason(s) the
 * patient told us they're taking it, when both are on file. Silent unless
 * the patient reported at least one condition we have a real class mapping
 * for — never flags a drug/condition pair we have no basis to judge, and
 * never treats "didn't tell us" as a mismatch. Non-blocking by design: this
 * is a plausibility nudge (drugs are legitimately used off-label), not a
 * clinical determination.
 */
export function checkIndication(input: ScreeningInput): Flag[] {
  const { patient, drugLine, formulary } = input;
  if (!patient || !patient.reportedConditions || patient.reportedConditions.length === 0) return [];

  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const reportedConditions = patient.reportedConditions as PatientCondition[];
  const expectedClasses = new Set(reportedConditions.flatMap((c) => CONDITION_TO_DRUG_CLASSES[c] ?? []));
  if (expectedClasses.size === 0 || expectedClasses.has(drug.class)) return [];

  return [
    buildFlag({
      type: "indication_mismatch",
      code: "INDICATION_MISMATCH",
      severity: "minor",
      clinical: `${drug.generic_name} (${drug.class}) does not match the patient-reported reason(s) for this prescription (${reportedConditions.join(", ")}). May be appropriate off-label or for an unstated condition — confirm with the patient.`,
      patient: `You told us this is for ${formatList(reportedConditions)}, but ${drug.generic_name} isn't typically used for that. Worth confirming with your pharmacist that it's the right medicine for your condition.`,
      relatedDrugId: drug.id,
    }),
  ];
}
