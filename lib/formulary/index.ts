import type { FormularyBundle } from "../types";
import { ghanaAllergyRules } from "./ghana/allergyRules";
import { ghanaAlcoholInteractionRules } from "./ghana/alcoholInteractionRules";
import { ghanaDrugs } from "./ghana/drugs";
import { ghanaFoodInteractionRules } from "./ghana/foodInteractionRules";
import { ghanaInteractionRules } from "./ghana/interactionRules";

const formularyRegistry: Record<string, () => FormularyBundle> = {
  GH: () => ({
    region: "GH",
    drugs: ghanaDrugs,
    interactionRules: ghanaInteractionRules,
    allergyRules: ghanaAllergyRules,
    foodInteractionRules: ghanaFoodInteractionRules,
    alcoholInteractionRules: ghanaAlcoholInteractionRules,
  }),
};

export function getFormularyBundle(region: string): FormularyBundle {
  const factory = formularyRegistry[region];
  if (!factory) {
    throw new Error(`No formulary registered for region "${region}"`);
  }
  return factory();
}

export const DEFAULT_REGION = "GH";
