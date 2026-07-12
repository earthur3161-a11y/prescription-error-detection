import type { InteractionRule } from "../../types";

// Sourced from official FDA-approved drug labels (Section 7 "Drug
// Interactions" / equivalent), retrieved via openFDA (api.fda.gov), a free
// public U.S. government API indexing the actual prescribing information for
// FDA-approved products. This is NOT a Ghana-specific source — the previous
// version of this file claimed specific Ghana STG chapter citations (e.g.
// "Ch. 3 Cardiovascular") that were fabricated and did not match the real
// document's structure (verified directly against the actual STG text: Ch.3
// is Nutritional Disorders, not Cardiovascular; real Cardiovascular is Ch.7).
// Drug-drug interaction severity is largely universal pharmacology rather
// than a country-specific treatment convention, and Ghana's STG is organised
// by disease/condition, not as an interaction matrix — it doesn't cover this
// category of fact at all. Where a pair could not be confirmed against any
// fetched FDA label, that's stated explicitly rather than left silently
// citing a source that doesn't actually support it.
export const ghanaInteractionRules: InteractionRule[] = [
  {
    id: "int_warfarin_aspirin",
    drug_a: "drug_warfarin",
    drug_b: "drug_aspirin",
    severity: "severe",
    description:
      "Concurrent use significantly increases bleeding risk (additive antiplatelet/anticoagulant effect).",
    referenceSource:
      "FDA warfarin sodium label, Section 7.3 \"Drugs that Increase Bleeding Risk\" — aspirin explicitly listed under Antiplatelet Agents (via openFDA).",
  },
  {
    id: "int_warfarin_metronidazole",
    drug_a: "drug_warfarin",
    drug_b: "drug_metronidazole",
    severity: "major",
    description:
      "Metronidazole inhibits warfarin metabolism, markedly increasing bleeding risk. Monitor INR closely.",
    referenceSource:
      "FDA warfarin sodium label, Section 7.2 \"CYP450 Interactions\" — metronidazole listed as a CYP2C9 inhibitor, which increases warfarin exposure/INR (via openFDA).",
  },
  {
    id: "int_warfarin_ciprofloxacin",
    drug_a: "drug_warfarin",
    drug_b: "drug_ciprofloxacin",
    severity: "moderate",
    description: "Ciprofloxacin may potentiate the anticoagulant effect of warfarin.",
    referenceSource:
      "FDA warfarin sodium label, Section 7.2 — ciprofloxacin listed as a CYP1A2 and CYP3A4 inhibitor. Cross-confirmed in the FDA ciprofloxacin ophthalmic label's general-class note that systemic quinolones \"enhance the effects of the oral anticoagulant, warfarin\" (via openFDA).",
  },
  {
    id: "int_sp_cotrimoxazole",
    drug_a: "drug_sulfadoxine_pyrimethamine",
    drug_b: "drug_cotrimoxazole",
    severity: "major",
    description:
      "Both are antifolate agents; concurrent use increases risk of hematologic toxicity (e.g. megaloblastic anemia).",
    referenceSource:
      "Confirmed on both sides: FDA pyrimethamine label states concomitant \"trimethoprim-sulfamethoxazole combinations...may increase the risk of bone marrow suppression\"; FDA sulfamethoxazole/trimethoprim label separately states patients on pyrimethamine malaria prophylaxis \"may develop megaloblastic anemia if sulfamethoxazole and trimethoprim is prescribed\" (via openFDA).",
  },
  {
    id: "int_metformin_furosemide",
    drug_a: "drug_metformin",
    drug_b: "drug_furosemide",
    severity: "moderate",
    description:
      "Furosemide may increase metformin plasma concentration and affect renal clearance — monitor renal function.",
    referenceSource:
      "NOT CONFIRMED against an FDA label — this specific pairing does not appear in the fetched metformin-combination-product or furosemide labels' drug-interaction sections (checked via openFDA). Kept as illustrative pharmacological plausibility (loop diuretics can affect renal drug clearance generally), not a verified citation. Flagging rather than removing so this isn't silently presented as more authoritative than it is.",
  },
  {
    id: "int_ibuprofen_losartan",
    drug_a: "drug_ibuprofen",
    drug_b: "drug_losartan",
    severity: "moderate",
    description:
      "NSAIDs may reduce the antihypertensive effect of ARBs and increase risk of renal impairment.",
    referenceSource:
      "FDA losartan potassium label, Section 7.3 \"Non-Steroidal Anti-Inflammatory Drugs (NSAIDs)\" — explicitly describes both the renal-function deterioration risk and attenuated antihypertensive effect (via openFDA).",
  },
  {
    id: "int_diazepam_salbutamol",
    drug_a: "drug_diazepam",
    drug_b: "drug_salbutamol",
    severity: "minor",
    description: "Sedative effect of diazepam may mask early signs of salbutamol overuse.",
    referenceSource:
      "NOT CONFIRMED against an FDA label — diazepam's drug-interactions section (opioids, other centrally-acting agents, alcohol, antacids, CYP3A/2C19 inhibitors, phenytoin) does not mention salbutamol/albuterol or beta-agonist bronchodilators at all (checked via openFDA). Kept as illustrative only, not a verified citation.",
  },
  {
    id: "int_glibenclamide_ciprofloxacin",
    drug_a: "drug_glibenclamide",
    drug_b: "drug_ciprofloxacin",
    severity: "moderate",
    description:
      "Fluoroquinolones may potentiate the hypoglycemic effect of sulfonylureas — monitor blood glucose.",
    referenceSource:
      "FDA glyburide label, Drug Interactions section, verbatim: \"A possible interaction between glyburide and ciprofloxacin, a fluoroquinolone antibiotic, has been reported, resulting in a potentiation of the hypoglycemic action of glyburide\" (via openFDA; glyburide is the US name for glibenclamide).",
  },
  {
    id: "int_simvastatin_clarithromycin",
    drug_a: "drug_simvastatin",
    drug_b: "drug_clarithromycin",
    severity: "severe",
    description:
      "Clarithromycin strongly inhibits simvastatin metabolism (CYP3A4), sharply raising the risk of myopathy and rhabdomyolysis. Concomitant use is contraindicated per both drugs' FDA labels — suspend the statin during the course.",
    referenceSource:
      "Confirmed as an explicit CONTRAINDICATION on both sides: FDA simvastatin label lists clarithromycin among \"strong CYP3A4 inhibitors\" whose concomitant use \"is contraindicated\"; FDA clarithromycin label separately states \"concomitant administration of clarithromycin tablets with HMG-CoA reductase inhibitors...that are extensively metabolized by CYP3A4 (lovastatin or simvastatin) is contraindicated\" (via openFDA). Severity raised from \"major\" to \"severe\" to reflect the absolute contraindication in the real source, not a downstream inference.",
  },
  {
    id: "int_simvastatin_erythromycin",
    drug_a: "drug_simvastatin",
    drug_b: "drug_erythromycin",
    severity: "severe",
    description:
      "Erythromycin inhibits simvastatin metabolism (CYP3A4), increasing the risk of myopathy and rhabdomyolysis. Concomitant use is contraindicated per the simvastatin FDA label.",
    referenceSource:
      "FDA simvastatin label, Section 7.1 — erythromycin explicitly listed among \"strong CYP3A4 inhibitors\" (select macrolide antibiotics) whose concomitant use with simvastatin \"is contraindicated\" (via openFDA). Severity raised from \"major\" to \"severe\" to reflect the absolute contraindication in the real source.",
  },
  {
    id: "int_lisinopril_spironolactone",
    drug_a: "drug_lisinopril",
    drug_b: "drug_spironolactone",
    severity: "major",
    description:
      "Combining an ACE inhibitor with a potassium-sparing diuretic markedly increases the risk of dangerous hyperkalaemia — monitor serum potassium and renal function.",
    referenceSource:
      "FDA lisinopril label, Drug Interactions, \"Agents Increasing Serum Potassium\" — spironolactone named explicitly; \"should be used with caution and with frequent monitoring of serum potassium\" (via openFDA).",
  },
  {
    id: "int_enalapril_spironolactone",
    drug_a: "drug_enalapril",
    drug_b: "drug_spironolactone",
    severity: "major",
    description:
      "Combining an ACE inhibitor with a potassium-sparing diuretic markedly increases the risk of dangerous hyperkalaemia — monitor serum potassium and renal function.",
    referenceSource:
      "FDA enalapril maleate label, Drug Interactions, \"Agents Increasing Serum Potassium\" — spironolactone named explicitly; also states potassium-sparing agents \"should generally not be used in patients with heart failure receiving enalapril maleate\" (via openFDA).",
  },
  {
    id: "int_warfarin_naproxen",
    drug_a: "drug_warfarin",
    drug_b: "drug_naproxen",
    severity: "severe",
    description:
      "Concurrent NSAID and anticoagulant use greatly increases the risk of gastrointestinal and other serious bleeding.",
    referenceSource:
      "Confirmed on both sides: FDA warfarin label lists naproxen under \"Drugs that Increase Bleeding Risk\"; FDA naproxen label states \"naproxen and anticoagulants such as warfarin have a synergistic effect on bleeding\" with an \"increased risk of serious bleeding compared to the use of either drug alone\" (via openFDA).",
  },
  {
    id: "int_warfarin_fluconazole",
    drug_a: "drug_warfarin",
    drug_b: "drug_fluconazole",
    severity: "major",
    description:
      "Fluconazole inhibits warfarin metabolism, potentiating its anticoagulant effect and raising bleeding risk — monitor INR closely.",
    referenceSource:
      "Confirmed on both sides: FDA warfarin label lists fluconazole as a CYP2C9 and CYP3A4 inhibitor; FDA fluconazole label separately reports a clinical study showing a significant increase in prothrombin-time response with concomitant warfarin (via openFDA).",
  },
  {
    id: "int_digoxin_furosemide",
    drug_a: "drug_digoxin",
    drug_b: "drug_furosemide",
    severity: "moderate",
    description:
      "Loop-diuretic-induced hypokalaemia potentiates digoxin toxicity — monitor potassium and for signs of toxicity.",
    referenceSource:
      "FDA furosemide label, Precautions: \"Digitalis therapy may exaggerate metabolic effects of hypokalemia, especially myocardial effects\" (via openFDA).",
  },
  {
    id: "int_lisinopril_naproxen",
    drug_a: "drug_lisinopril",
    drug_b: "drug_naproxen",
    severity: "moderate",
    description:
      "NSAIDs reduce the antihypertensive effect of ACE inhibitors and, combined, increase the risk of renal impairment.",
    referenceSource:
      "Confirmed on both sides: FDA lisinopril label, Drug Interactions — NSAID co-administration \"may result in deterioration of renal function\" and antihypertensive effect \"may be attenuated by NSAIDs\"; FDA naproxen label's Table 1 independently states the same for \"ACE Inhibitors, Angiotensin Receptor Blockers, and Beta-Blockers\" (via openFDA).",
  },
];
