import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Flags a drug against the sourced food-interaction reference data
 * (lib/formulary/ghana/foodInteractionRules.ts). Unlike the patient-attribute
 * checks elsewhere in this engine (renal/hepatic/pregnancy/age), a drug with
 * no matching rule is NOT an unknown-data case — there's no patient
 * attribute that could be missing here, only a drug that either has a
 * sourced interaction on file or doesn't. No unknown-severity guard applies;
 * absence of a rule genuinely means "no known food interaction," the same
 * way emlCheck.ts's "on the EML" isn't guarded by an unknown case either.
 */
export function checkFoodInteraction(input: ScreeningInput): Flag[] {
  const { drugLine, formulary } = input;
  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const rules = formulary.foodInteractionRules.filter((r) => r.drug_id === drug.id);

  return rules.map((rule) =>
    buildFlag({
      type: "drug_food_interaction",
      code: "DRUG_FOOD_INTERACTION",
      severity: rule.severity,
      clinical: `${drug.generic_name} + ${rule.food}: ${rule.description} ${rule.guidance}`,
      patient: `${drug.generic_name} interacts with ${rule.food.toLowerCase()}. ${rule.guidance}`,
      referenceSource: rule.referenceSource,
    })
  );
}
