import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Flags drugs not on the region's Essential Medicines List. Minor severity —
 * floors the line at "caution" (via deriveVerdict) without ever blocking on
 * its own, since a non-EML drug isn't unsafe, just outside the preferred
 * formulary. Suggests the EML-listed alternative when one is on file.
 */
export function checkEML(input: ScreeningInput): Flag[] {
  const { drugLine, formulary } = input;
  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug || drug.onEssentialMedicinesList) return [];

  const alternative = drug.emlAlternativeDrugId
    ? formulary.drugs.find((d) => d.id === drug.emlAlternativeDrugId)
    : undefined;

  return [
    buildFlag({
      type: "eml_compliance",
      code: "NOT_ON_EML",
      severity: "minor",
      clinical: `${drug.generic_name} is not on Ghana's Essential Medicines List.${
        alternative ? ` Consider ${alternative.generic_name}, an EML-listed alternative in the same role.` : ""
      }`,
      patient: `${drug.generic_name} isn't on Ghana's standard list of essential medicines.${
        alternative
          ? ` A pharmacist may be able to suggest ${alternative.generic_name} instead.`
          : " This isn't necessarily unsafe, but it's worth asking your pharmacist about."
      }`,
      referenceSource: "Ghana Essential Medicines List, 7th Edition (2017)",
      relatedDrugId: alternative?.id,
    }),
  ];
}
