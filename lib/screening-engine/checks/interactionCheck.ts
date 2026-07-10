import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";
import type { InteractionSeverity } from "../../types";

function patientInteractionPhrase(severity: InteractionSeverity): string {
  switch (severity) {
    case "severe":
    case "major":
      return "can be dangerous when taken together";
    case "moderate":
      return "may not mix well together";
    default:
      return "is worth mentioning to your pharmacist";
  }
}

/**
 * Drug-drug interaction check against the rest of the current prescription
 * plus the patient's active medication list. Guards its own required input:
 * a null active-medication list is never treated as "on no medications."
 */
export function checkInteraction(input: ScreeningInput): Flag[] {
  const { patient, drugLine, otherLines, formulary } = input;

  const flags: Flag[] = [];

  if (patient?.activeMedications === null) {
    flags.push(
      buildFlag({
        type: "interaction",
        code: "MEDICATION_DATA_UNKNOWN",
        severity: "unknown",
        clinical: "Current medication list not on file for this patient — interactions cannot be fully verified.",
        patient: "We don't know what other medicines you're taking, so please double-check with your pharmacist.",
      })
    );
  }

  const otherDrugIds = new Set<string>([
    ...otherLines.filter((l) => l.id !== drugLine.id).map((l) => l.drugId),
    ...(patient?.activeMedications ?? []).map((m) => m.drugId),
  ]);
  otherDrugIds.delete(drugLine.drugId);

  for (const otherDrugId of otherDrugIds) {
    const rule = formulary.interactionRules.find(
      (r) =>
        (r.drug_a === drugLine.drugId && r.drug_b === otherDrugId) ||
        (r.drug_b === drugLine.drugId && r.drug_a === otherDrugId)
    );
    if (!rule) continue;

    const otherDrug = formulary.drugs.find((d) => d.id === otherDrugId);
    const otherName = otherDrug?.generic_name ?? "another active medication";

    flags.push(
      buildFlag({
        type: "interaction",
        code: "DRUG_DRUG_INTERACTION",
        severity: rule.severity,
        clinical: `${rule.severity[0].toUpperCase()}${rule.severity.slice(1)} interaction with ${otherName}: ${rule.description}`,
        patient: `This medicine and ${otherName} (which you're already taking) ${patientInteractionPhrase(rule.severity)}.`,
        referenceSource: rule.referenceSource,
        relatedDrugId: otherDrugId,
      })
    );
  }

  return flags;
}
