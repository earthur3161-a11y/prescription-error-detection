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

/**
 * The static, code-committed base formulary ONLY — never includes
 * admin-added custom drugs (custom_drugs, 0026_custom_drugs.sql). Renamed
 * from getFormularyBundle specifically so a bare "the formulary" call can't
 * silently return an incomplete picture again (that's exactly how Admin
 * Formulary Management's original bug happened — see mergeCustomDrugs.ts).
 *
 * There are exactly three legitimate reasons to call this directly rather
 * than a merged bundle: seeding (scripts/seed-supabase.ts, lib/data/db.ts's
 * Dexie bootstrap — both populate a base reference dataset, not "what a
 * screening should see"), and tests that specifically exercise the static
 * formulary's own content. Every real screening surface must use
 * getServerFormularyBundle() (server) or useFormulary()/
 * getCachedFormularyBundle() (client) instead — both already include
 * custom drugs.
 */
export function getBaseFormularyBundle(region: string): FormularyBundle {
  const factory = formularyRegistry[region];
  if (!factory) {
    throw new Error(`No formulary registered for region "${region}"`);
  }
  return factory();
}

export const DEFAULT_REGION = "GH";
