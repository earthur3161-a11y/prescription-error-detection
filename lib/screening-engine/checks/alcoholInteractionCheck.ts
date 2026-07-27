import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Flags a drug against the sourced alcohol-interaction reference data
 * (lib/formulary/ghana/alcoholInteractionRules.ts). Same convention as
 * foodInteractionCheck.ts: absence of a matching rule means "no known
 * alcohol interaction," not unknown data — there's no patient attribute
 * involved, so no unknown-severity guard applies here.
 */
export function checkAlcoholInteraction(input: ScreeningInput): Flag[] {
  const { drugLine, formulary } = input;
  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const rules = formulary.alcoholInteractionRules.filter((r) => r.drug_id === drug.id);

  return rules.map((rule) =>
    buildFlag({
      type: "drug_alcohol_interaction",
      code: "DRUG_ALCOHOL_INTERACTION",
      severity: rule.severity,
      clinical: `${drug.generic_name} + alcohol: ${rule.description} ${rule.guidance}`,
      patient: `${drug.generic_name} interacts with alcohol. ${rule.guidance}`,
      referenceSource: rule.referenceSource,
    })
  );
}
