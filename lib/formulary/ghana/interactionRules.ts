import type { InteractionRule } from "../../types";

export const ghanaInteractionRules: InteractionRule[] = [
  {
    id: "int_warfarin_aspirin",
    drug_a: "drug_warfarin",
    drug_b: "drug_aspirin",
    severity: "severe",
    description:
      "Concurrent use significantly increases bleeding risk (additive antiplatelet/anticoagulant effect).",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Anticoagulant Interactions",
  },
  {
    id: "int_warfarin_metronidazole",
    drug_a: "drug_warfarin",
    drug_b: "drug_metronidazole",
    severity: "major",
    description:
      "Metronidazole inhibits warfarin metabolism, markedly increasing bleeding risk. Monitor INR closely.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Anticoagulant Interactions",
  },
  {
    id: "int_warfarin_ciprofloxacin",
    drug_a: "drug_warfarin",
    drug_b: "drug_ciprofloxacin",
    severity: "moderate",
    description: "Ciprofloxacin may potentiate the anticoagulant effect of warfarin.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Anticoagulant Interactions",
  },
  {
    id: "int_sp_cotrimoxazole",
    drug_a: "drug_sulfadoxine_pyrimethamine",
    drug_b: "drug_cotrimoxazole",
    severity: "major",
    description:
      "Both are antifolate agents; concurrent use increases risk of hematologic toxicity (e.g. megaloblastic anemia).",
    referenceSource: "Ghana STG 2017, Ch. 13 (Malaria) — Antifolate Combination Risk",
  },
  {
    id: "int_metformin_furosemide",
    drug_a: "drug_metformin",
    drug_b: "drug_furosemide",
    severity: "moderate",
    description:
      "Furosemide may increase metformin plasma concentration and affect renal clearance — monitor renal function.",
    referenceSource: "Ghana STG 2017, Ch. 9 (Endocrine) — Antidiabetic Interactions",
  },
  {
    id: "int_ibuprofen_losartan",
    drug_a: "drug_ibuprofen",
    drug_b: "drug_losartan",
    severity: "moderate",
    description:
      "NSAIDs may reduce the antihypertensive effect of ARBs and increase risk of renal impairment.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — NSAID/ARB Interaction",
  },
  {
    id: "int_diazepam_salbutamol",
    drug_a: "drug_diazepam",
    drug_b: "drug_salbutamol",
    severity: "minor",
    description: "Sedative effect of diazepam may mask early signs of salbutamol overuse.",
    referenceSource: "Ghana STG 2017, Ch. 4 (Respiratory) — Bronchodilator Monitoring",
  },
  {
    id: "int_glibenclamide_ciprofloxacin",
    drug_a: "drug_glibenclamide",
    drug_b: "drug_ciprofloxacin",
    severity: "moderate",
    description:
      "Fluoroquinolones may potentiate the hypoglycemic effect of sulfonylureas — monitor blood glucose.",
    referenceSource: "Ghana STG 2017, Ch. 9 (Endocrine) — Antidiabetic Interactions",
  },
  {
    id: "int_simvastatin_clarithromycin",
    drug_a: "drug_simvastatin",
    drug_b: "drug_clarithromycin",
    severity: "major",
    description:
      "Clarithromycin strongly inhibits simvastatin metabolism (CYP3A4), sharply raising the risk of myopathy and rhabdomyolysis. Suspend the statin during the course.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Statin Interactions",
  },
  {
    id: "int_simvastatin_erythromycin",
    drug_a: "drug_simvastatin",
    drug_b: "drug_erythromycin",
    severity: "major",
    description:
      "Erythromycin inhibits simvastatin metabolism (CYP3A4), increasing the risk of myopathy and rhabdomyolysis.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Statin Interactions",
  },
  {
    id: "int_lisinopril_spironolactone",
    drug_a: "drug_lisinopril",
    drug_b: "drug_spironolactone",
    severity: "major",
    description:
      "Combining an ACE inhibitor with a potassium-sparing diuretic markedly increases the risk of dangerous hyperkalaemia — monitor serum potassium and renal function.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Hyperkalaemia Risk",
  },
  {
    id: "int_enalapril_spironolactone",
    drug_a: "drug_enalapril",
    drug_b: "drug_spironolactone",
    severity: "major",
    description:
      "Combining an ACE inhibitor with a potassium-sparing diuretic markedly increases the risk of dangerous hyperkalaemia — monitor serum potassium and renal function.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Hyperkalaemia Risk",
  },
  {
    id: "int_warfarin_naproxen",
    drug_a: "drug_warfarin",
    drug_b: "drug_naproxen",
    severity: "severe",
    description:
      "Concurrent NSAID and anticoagulant use greatly increases the risk of gastrointestinal and other serious bleeding.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Anticoagulant Interactions",
  },
  {
    id: "int_warfarin_fluconazole",
    drug_a: "drug_warfarin",
    drug_b: "drug_fluconazole",
    severity: "major",
    description:
      "Fluconazole inhibits warfarin metabolism, potentiating its anticoagulant effect and raising bleeding risk — monitor INR closely.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Anticoagulant Interactions",
  },
  {
    id: "int_digoxin_furosemide",
    drug_a: "drug_digoxin",
    drug_b: "drug_furosemide",
    severity: "moderate",
    description:
      "Loop-diuretic-induced hypokalaemia potentiates digoxin toxicity — monitor potassium and for signs of toxicity.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — Digoxin Monitoring",
  },
  {
    id: "int_lisinopril_naproxen",
    drug_a: "drug_lisinopril",
    drug_b: "drug_naproxen",
    severity: "moderate",
    description:
      "NSAIDs reduce the antihypertensive effect of ACE inhibitors and, combined, increase the risk of renal impairment.",
    referenceSource: "Ghana STG 2017, Ch. 3 (Cardiovascular) — NSAID/ACE-inhibitor Interaction",
  },
];
