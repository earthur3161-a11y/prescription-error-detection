import type { AllergyRule } from "../../types";

// Sourced from official FDA-approved drug labels (Warnings/Contraindications
// sections), retrieved via openFDA (api.fda.gov) — see the sourcing note at
// the top of interactionRules.ts for why this uses FDA labels rather than
// Ghana STG (allergy cross-reactivity is pharmacology, not a country-guideline
// fact, and Ghana STG doesn't cover it). The previous version of this file
// claimed specific Ghana STG chapter citations that were fabricated and did
// not match the real document's structure.
export const ghanaAllergyRules: AllergyRule[] = [
  {
    id: "alg_penicillin",
    allergen: "Penicillin",
    related_drug_classes: ["Penicillin"],
    severity: "severe",
    reaction: "an allergic reaction — ranging from a skin rash or hives to a severe, life-threatening reaction (anaphylaxis)",
    cross_reactive_classes: [
      {
        class: "Cephalosporin",
        severity: "moderate",
        reaction:
          "a cross-reactive allergic reaction — FDA labeling reports this in up to 10% of patients with a penicillin allergy",
      },
    ],
    referenceSource:
      "Confirmed bidirectionally: FDA penicillin G label warns individuals with penicillin hypersensitivity \"have experienced severe reactions when treated with cephalosporins\"; FDA ceftriaxone label states patients with prior penicillin/beta-lactam hypersensitivity \"may be at greater risk of hypersensitivity to ceftriaxone.\" FDA cephalexin label quantifies this: \"cross-hypersensitivity among beta-lactam antibacterial drugs may occur in up to 10% of patients with a history of penicillin allergy\" (via openFDA).",
  },
  {
    id: "alg_nsaid",
    allergen: "NSAIDs/Aspirin",
    related_drug_classes: ["NSAID"],
    severity: "severe",
    reaction: "a severe allergic reaction — hives, facial swelling, shock, or an asthma/wheezing attack",
    referenceSource:
      "Confirmed bidirectionally: FDA OTC aspirin label's \"Allergy alert\" warns of severe allergic reaction (hives, facial swelling, shock, asthma/wheezing); FDA OTC ibuprofen label separately warns \"Ibuprofen may cause a severe allergic reaction, especially in people allergic to aspirin.\" FDA naproxen label lists \"history of asthma, urticaria, or other allergic-type reactions after taking aspirin or other NSAIDs\" as an outright contraindication (via openFDA).",
  },
  {
    id: "alg_sulfa",
    allergen: "Sulfa drugs",
    related_drug_classes: ["Antifolate Antibacterial", "Antifolate Antimalarial", "Sulfonylurea (Antidiabetic)"],
    severity: "major",
    reaction:
      "a hypersensitivity reaction, which in rare but serious cases includes Stevens-Johnson syndrome, toxic epidermal necrolysis, or blood cell abnormalities",
    referenceSource:
      "FDA sulfamethoxazole/trimethoprim label, Contraindications: \"known hypersensitivity to trimethoprim or sulfonamides\"; Warnings section separately describes rare but serious sulfonamide hypersensitivity reactions (Stevens-Johnson syndrome, toxic epidermal necrolysis, blood dyscrasias) (via openFDA).",
  },
  {
    id: "alg_fluoroquinolone",
    allergen: "Fluoroquinolones",
    related_drug_classes: ["Fluoroquinolone"],
    severity: "severe",
    reaction: "a serious, sometimes fatal, anaphylactic (severe allergic) reaction — which can occur even after the first dose",
    referenceSource:
      "FDA ciprofloxacin label, Warnings: \"Serious and occasionally fatal hypersensitivity (anaphylactic) reactions, some following the first dose, have been reported in patients receiving systemic quinolone therapy\" (via openFDA).",
  },
  {
    id: "alg_cephalosporin",
    allergen: "Cephalosporins",
    related_drug_classes: ["Cephalosporin"],
    severity: "major",
    reaction: "an allergic reaction — ranging from a skin rash or hives to a severe, life-threatening reaction (anaphylaxis)",
    cross_reactive_classes: [
      {
        class: "Penicillin",
        severity: "moderate",
        reaction:
          "a cross-reactive allergic reaction — FDA labeling reports this in up to 10% of patients with a penicillin allergy",
      },
    ],
    referenceSource:
      "Same bidirectional sourcing as alg_penicillin above: FDA cephalexin, ceftriaxone, and penicillin G labels (via openFDA) — cross-hypersensitivity reported in up to ~10% of penicillin-allergic patients.",
  },
  {
    id: "alg_macrolide",
    allergen: "Macrolides",
    related_drug_classes: ["Macrolide"],
    severity: "moderate",
    reaction: "an allergic reaction to this class of antibiotics, similar to a reaction to erythromycin or clarithromycin",
    referenceSource:
      "FDA clarithromycin label, Contraindications, verbatim: \"Clarithromycin tablets are contraindicated in patients with a known hypersensitivity to clarithromycin, erythromycin, or any of the macrolide antibacterial drugs\" — an explicit, class-wide cross-hypersensitivity statement (via openFDA).",
  },
  // Two further classes below, found by the same audit that expanded
  // interactionRules.ts. Sourced the same way — a real, explicit, class-wide
  // FDA cross-sensitivity statement, not an inference. Several other
  // candidates considered (Statins, Opioids, aromatic Anticonvulsants) were
  // deliberately NOT added: their FDA labels state drug-specific
  // hypersensitivity contraindications, not a class-wide cross-reactivity
  // statement the way Aminoglycoside/Tetracycline/Cephalosporin/Macrolide do
  // above, and the Anticonvulsant class in this formulary also contains
  // chemically unrelated drugs (valproate, lamotrigine, ethosuximide) that
  // the one real cross-reactivity statement found (aromatic anticonvulsants
  // only: carbamazepine/phenytoin/phenobarbital/primidone) does not cover —
  // adding it under the broad "Anticonvulsant" class would incorrectly flag
  // those unrelated drugs, so it was left out rather than forced.
  {
    id: "alg_aminoglycoside",
    allergen: "Aminoglycosides",
    related_drug_classes: ["Aminoglycoside"],
    severity: "severe",
    reaction: "an allergic reaction to this class of antibiotics — known to have cross-sensitivity across the group",
    referenceSource:
      "FDA gentamicin label, Contraindications, verbatim: \"Hypersensitivity to gentamicin is a contraindication to its use. A history of hypersensitivity or serious toxic reactions to other aminoglycosides may contraindicate use of gentamicin because of the known cross-sensitivity of patients to drugs in this class\" (via openFDA).",
  },
  {
    id: "alg_tetracycline",
    allergen: "Tetracyclines",
    related_drug_classes: ["Tetracycline"],
    severity: "severe",
    reaction: "an allergic reaction to this class of antibiotics",
    referenceSource:
      "FDA doxycycline label, Contraindications, verbatim: \"This drug is contraindicated in persons who have shown hypersensitivity to any of the tetracyclines\" — an explicit, class-wide cross-hypersensitivity statement (via openFDA).",
  },
];
