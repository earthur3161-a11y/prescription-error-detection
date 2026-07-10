import type { AllergyRule } from "../../types";

export const ghanaAllergyRules: AllergyRule[] = [
  {
    id: "alg_penicillin",
    allergen: "Penicillin",
    related_drug_classes: ["Penicillin"],
    severity: "severe",
    cross_reactive_classes: [{ class: "Cephalosporin", severity: "moderate" }],
    referenceSource: "Ghana STG 2017, Ch. 12 (Infections) — Beta-lactam Allergy & Cross-reactivity",
  },
  {
    id: "alg_nsaid",
    allergen: "NSAIDs/Aspirin",
    related_drug_classes: ["NSAID"],
    severity: "severe",
    referenceSource: "Ghana STG 2017, Ch. 8 (Musculoskeletal) — NSAID Hypersensitivity",
  },
  {
    id: "alg_sulfa",
    allergen: "Sulfa drugs",
    related_drug_classes: ["Antifolate Antibacterial", "Antifolate Antimalarial", "Sulfonylurea (Antidiabetic)"],
    severity: "major",
    referenceSource: "Ghana STG 2017, Ch. 12 (Infections) — Sulfonamide Hypersensitivity",
  },
  {
    id: "alg_fluoroquinolone",
    allergen: "Fluoroquinolones",
    related_drug_classes: ["Fluoroquinolone"],
    severity: "severe",
    referenceSource: "Ghana STG 2017, Ch. 12 (Infections) — Fluoroquinolone Hypersensitivity",
  },
  {
    id: "alg_cephalosporin",
    allergen: "Cephalosporins",
    related_drug_classes: ["Cephalosporin"],
    severity: "major",
    cross_reactive_classes: [{ class: "Penicillin", severity: "moderate" }],
    referenceSource: "Ghana STG 2017, Ch. 12 (Infections) — Beta-lactam Allergy & Cross-reactivity",
  },
  {
    id: "alg_macrolide",
    allergen: "Macrolides",
    related_drug_classes: ["Macrolide"],
    severity: "moderate",
    referenceSource: "Ghana STG 2017, Ch. 12 (Infections) — Macrolide Hypersensitivity",
  },
];
