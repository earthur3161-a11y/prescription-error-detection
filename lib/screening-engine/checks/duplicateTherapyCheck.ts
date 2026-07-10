import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Flags when a drug of the same therapeutic class as this line is already
 * active elsewhere in the current prescription or the patient's active
 * medication list.
 */
export function checkDuplicateTherapy(input: ScreeningInput): Flag[] {
  const { patient, drugLine, otherLines, formulary } = input;

  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const otherDrugIds = new Set<string>([
    ...otherLines.filter((l) => l.id !== drugLine.id).map((l) => l.drugId),
    ...(patient?.activeMedications ?? []).map((m) => m.drugId),
  ]);
  otherDrugIds.delete(drugLine.drugId);

  const flags: Flag[] = [];

  for (const otherDrugId of otherDrugIds) {
    const otherDrug = formulary.drugs.find((d) => d.id === otherDrugId);
    if (!otherDrug || otherDrug.class !== drug.class) continue;

    flags.push(
      buildFlag({
        type: "duplicate_therapy",
        code: "DUPLICATE_THERAPEUTIC_CLASS",
        severity: "moderate",
        clinical: `Patient is already prescribed ${otherDrug.generic_name}, also a ${drug.class} — review for duplicate therapy before adding ${drug.generic_name}.`,
        patient: `You may already be taking another medicine for the same thing (${otherDrug.generic_name}) — taking both isn't usually necessary and could add side effects.`,
        relatedDrugId: otherDrugId,
      })
    );
  }

  return flags;
}
