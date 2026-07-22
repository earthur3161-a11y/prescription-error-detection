import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Direct allergen-name matches and drug-class matches against the patient's
 * recorded allergies, including cross-reactive classes (e.g. Penicillin
 * allergy -> moderate risk with Cephalosporins). Guards its own required
 * input: a null allergy list is never treated as "no allergies."
 */
export function checkAllergy(input: ScreeningInput): Flag[] {
  const { patient, drugLine, formulary } = input;
  if (!patient) return [];

  if (patient.allergies === null) {
    return [
      buildFlag({
        type: "allergy",
        code: "ALLERGY_DATA_UNKNOWN",
        severity: "unknown",
        clinical: "Allergy history not on file for this patient — verify manually before prescribing.",
        patient: "We don't have your allergy history on file, so please double-check with your pharmacist before taking this.",
      }),
    ];
  }

  if (patient.allergies.length === 0) return [];

  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const flags: Flag[] = [];

  for (const allergy of patient.allergies) {
    const rule = formulary.allergyRules.find(
      (r) => r.allergen.toLowerCase() === allergy.allergen.toLowerCase()
    );
    // KNOWN GAP, TRACKED FOLLOW-UP (not fixed here): a patient-reported
    // allergen with no matching AllergyRule (i.e. not one of the curated
    // categories in allergyRules.ts — Penicillin, NSAIDs/Aspirin, Sulfa
    // drugs, Fluoroquinolones, Cephalosporins, Macrolides) is silently
    // unscreened, with no "allergen not recognized, verify manually"
    // fallback flag. This is a *different* category from the unknown-data
    // gaps fixed elsewhere in this engine (renalStatus/hepaticStatus/
    // isPregnant/age): those were confirmed patient data with no rule to
    // interpret it; this is missing/sparse *reference* data (the allergen
    // itself was reported, we just have no rule authored for it) — same
    // root cause as an unrecognized drugId, not the null-vs-normal pattern.
    // Worth a "manual verification recommended" fallback flag eventually.
    if (!rule) continue;

    if (rule.related_drug_classes.includes(drug.class)) {
      flags.push(
        buildFlag({
          type: "allergy",
          code: "ALLERGY_DIRECT_MATCH",
          severity: rule.severity,
          clinical: `Patient has a recorded ${allergy.severity} allergy to ${allergy.allergen} — ${drug.generic_name} is a ${drug.class} and is contraindicated.`,
          patient: `Allergy alert: your profile lists a ${allergy.severity} allergy to ${allergy.allergen}. ${drug.generic_name} belongs to the same drug class and can cause ${rule.reaction}.`,
          referenceSource: rule.referenceSource,
          relatedDrugId: drug.id,
        })
      );
      continue;
    }

    const crossReactive = rule.cross_reactive_classes?.find(
      (c) => c.class === drug.class
    );
    if (crossReactive) {
      flags.push(
        buildFlag({
          type: "allergy",
          code: "ALLERGY_CROSS_REACTIVE",
          severity: crossReactive.severity,
          clinical: `Patient has a recorded allergy to ${allergy.allergen} — ${drug.generic_name} (${drug.class}) carries a risk of cross-reactivity.`,
          patient: `Allergy alert: your profile lists an allergy to ${allergy.allergen}. ${drug.generic_name} is a related medicine and can still cause ${crossReactive.reaction ?? rule.reaction}.`,
          referenceSource: rule.referenceSource,
          relatedDrugId: drug.id,
        })
      );
    }
  }

  return flags;
}
