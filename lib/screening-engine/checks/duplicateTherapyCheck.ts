import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Flags when a drug of the same therapeutic class as this line is already
 * active elsewhere in the current prescription or the patient's active
 * medication list. Guards its own required input: a null active-medication
 * list is never treated as "on no medications" — same convention as
 * allergyCheck/interactionCheck, since this check reads the identical
 * `activeMedications` field for a different clinical question (duplicate
 * therapeutic class, not interactions) and needs its own attributable flag
 * rather than relying on interactionCheck/dataCompletenessCheck's copy of
 * the same signal to cover for it.
 */
export function checkDuplicateTherapy(input: ScreeningInput): Flag[] {
  const { patient, drugLine, otherLines, formulary } = input;

  const flags: Flag[] = [];

  if (patient?.activeMedications === null) {
    flags.push(
      buildFlag({
        type: "duplicate_therapy",
        code: "MEDICATION_DATA_UNKNOWN",
        severity: "unknown",
        clinical: "Current medication list not on file for this patient — cannot verify this prescription doesn't duplicate an existing therapeutic class.",
        patient: "We don't know what other medicines you're taking, so we can't check whether this duplicates something you're already on — please tell your pharmacist everything you take.",
      })
    );
  }

  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return flags;

  const otherDrugIds = new Set<string>([
    ...otherLines.filter((l) => l.id !== drugLine.id).map((l) => l.drugId),
    ...(patient?.activeMedications ?? []).map((m) => m.drugId),
  ]);
  otherDrugIds.delete(drugLine.drugId);

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
