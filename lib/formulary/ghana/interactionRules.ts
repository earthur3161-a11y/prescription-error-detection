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
  // The pairs below fill a gap found while auditing coverage: 43 of the 65
  // drugs in the formulary (including Carbamazepine, Tramadol, and Morphine)
  // had zero interaction rules at all, even against each other. Sourced the
  // same way as above — direct FDA label quotes via openFDA, no inference.
  {
    id: "int_carbamazepine_warfarin",
    drug_a: "drug_carbamazepine",
    drug_b: "drug_warfarin",
    severity: "major",
    description:
      "Carbamazepine induces hepatic metabolism and reduces warfarin's anticoagulant effect — the opposite risk direction from most warfarin interactions (under-anticoagulation/clot risk rather than bleeding). Monitor INR closely when either drug is started or stopped.",
    referenceSource:
      "Confirmed on both sides: FDA carbamazepine label states carbamazepine \"causes...decreased levels of the following drugs...warfarin\"; FDA warfarin sodium label separately lists carbamazepine among CYP450 inducers that \"have the potential to decrease the effect (decrease INR) of warfarin\" (via openFDA).",
  },
  {
    id: "int_carbamazepine_levothyroxine",
    drug_a: "drug_carbamazepine",
    drug_b: "drug_levothyroxine",
    severity: "moderate",
    description: "Carbamazepine induces metabolism of levothyroxine, potentially reducing thyroid hormone replacement effect.",
    referenceSource:
      "FDA carbamazepine label, Drug Interactions: carbamazepine \"causes, or would be expected to cause, decreased levels of the following drugs...levothyroxine\" (via openFDA).",
  },
  {
    id: "int_carbamazepine_amitriptyline",
    drug_a: "drug_carbamazepine",
    drug_b: "drug_amitriptyline",
    severity: "moderate",
    description: "Carbamazepine induces metabolism of tricyclic antidepressants, potentially reducing amitriptyline's effect.",
    referenceSource:
      "FDA carbamazepine label, Drug Interactions: decreased levels of \"tricyclic antidepressants (e.g., imipramine, amitriptyline, nortriptyline)\"; the same label's Contraindications section separately notes carbamazepine should not be used in patients with known sensitivity to tricyclic compounds such as amitriptyline (via openFDA).",
  },
  {
    id: "int_carbamazepine_ciprofloxacin",
    drug_a: "drug_carbamazepine",
    drug_b: "drug_ciprofloxacin",
    severity: "moderate",
    description: "Ciprofloxacin can increase carbamazepine plasma levels, raising the risk of carbamazepine toxicity.",
    referenceSource:
      "FDA carbamazepine label, Drug Interactions: \"Drugs that have been shown, or would be expected, to increase plasma carbamazepine levels include...ciprofloxacin\" (via openFDA).",
  },
  {
    id: "int_carbamazepine_omeprazole",
    drug_a: "drug_carbamazepine",
    drug_b: "drug_omeprazole",
    severity: "moderate",
    description: "Omeprazole can increase carbamazepine plasma levels, raising the risk of carbamazepine toxicity.",
    referenceSource:
      "FDA carbamazepine label, Drug Interactions: \"Drugs that have been shown, or would be expected, to increase plasma carbamazepine levels include...omeprazole\" (via openFDA).",
  },
  {
    id: "int_carbamazepine_doxycycline",
    drug_a: "drug_carbamazepine",
    drug_b: "drug_doxycycline",
    severity: "moderate",
    description: "Carbamazepine induces metabolism of doxycycline, potentially reducing antibiotic efficacy and risking treatment failure.",
    referenceSource:
      "FDA carbamazepine label, Drug Interactions: carbamazepine \"causes, or would be expected to cause, decreased levels of the following drugs...doxycycline\" (via openFDA).",
  },
  {
    id: "int_carbamazepine_prednisolone",
    drug_a: "drug_carbamazepine",
    drug_b: "drug_prednisolone",
    severity: "moderate",
    description: "Carbamazepine induces metabolism of corticosteroids, potentially reducing prednisolone's effect.",
    referenceSource:
      "FDA carbamazepine label, Drug Interactions: decreased levels of \"corticosteroids (e.g., prednisolone, dexamethasone)\" (via openFDA).",
  },
  {
    id: "int_tramadol_carbamazepine",
    drug_a: "drug_tramadol",
    drug_b: "drug_carbamazepine",
    severity: "severe",
    description:
      "Carbamazepine markedly increases tramadol metabolism, reducing its analgesic effect, and separately raises tramadol's own seizure risk. Concomitant use is not recommended.",
    referenceSource:
      "Confirmed on both sides: FDA tramadol label states \"Patients taking carbamazepine, a CYP3A4 inducer, may have a significantly reduced analgesic effect of tramadol. Because carbamazepine increases tramadol metabolism and because of the seizure risk associated with tramadol, concomitant administration...and carbamazepine is not recommended\"; FDA carbamazepine label separately lists tramadol among drugs whose levels it decreases (via openFDA).",
  },
  {
    id: "int_tramadol_diazepam",
    drug_a: "drug_tramadol",
    drug_b: "drug_diazepam",
    severity: "severe",
    description:
      "Combining an opioid with a benzodiazepine causes additive CNS/respiratory depression — profound sedation, respiratory depression, coma, and death have occurred with this drug combination.",
    referenceSource:
      "FDA tramadol label, Warnings and Precautions 5.3 / Drug Interactions: \"Profound sedation, respiratory depression, coma, and death may result from the concomitant use of tramadol...with benzodiazepines and/or other CNS depressants\"; benzodiazepines explicitly listed as an example class (via openFDA).",
  },
  {
    id: "int_morphine_diazepam",
    drug_a: "drug_morphine",
    drug_b: "drug_diazepam",
    severity: "severe",
    description:
      "Combining an opioid with a benzodiazepine causes additive CNS/respiratory depression — profound sedation, respiratory depression, coma, and death have occurred with this drug combination.",
    referenceSource:
      "FDA morphine sulfate label, Warnings and Precautions 5.3 / Drug Interactions: \"Profound sedation, respiratory depression, coma, and death may result from the concomitant use of morphine sulfate tablets...with benzodiazepines and/or other CNS depressants\"; benzodiazepines explicitly listed as an example class (via openFDA).",
  },
  {
    id: "int_tramadol_amitriptyline",
    drug_a: "drug_tramadol",
    drug_b: "drug_amitriptyline",
    severity: "major",
    description:
      "Tricyclic antidepressants combined with tramadol raise the risk of serotonin syndrome and lower the seizure threshold, increasing tramadol's own seizure risk.",
    referenceSource:
      "FDA tramadol label, Drug Interactions: tricyclic antidepressants (TCAs) explicitly listed under both \"Serotonergic Drugs\" (serotonin syndrome risk) and \"Increased Risk of Seizures\" (via openFDA).",
  },
  {
    id: "int_tramadol_warfarin",
    drug_a: "drug_tramadol",
    drug_b: "drug_warfarin",
    severity: "moderate",
    description: "Tramadol may alter warfarin's anticoagulant effect — monitor INR when starting or stopping either drug.",
    referenceSource:
      "FDA tramadol label, Drug Interactions: \"Post-marketing surveillance of tramadol has revealed rare reports of alteration of warfarin effect, including elevation of prothrombin times\" (via openFDA).",
  },
  {
    id: "int_levothyroxine_ferrous_sulfate",
    drug_a: "drug_levothyroxine",
    drug_b: "drug_ferrous_sulfate",
    severity: "moderate",
    description:
      "Ferrous sulfate can bind levothyroxine in the gut and reduce its absorption. Manageable by spacing doses several hours apart.",
    referenceSource:
      "FDA levothyroxine sodium label, Drug Interactions, Table 5 (\"Drugs That May Decrease T4 Absorption\"): \"Phosphate Binders (e.g., calcium carbonate, ferrous sulfate, sevelamer, lanthanum) — Phosphate binders may bind to levothyroxine\" (via openFDA).",
  },
  {
    id: "int_quinine_digoxin",
    drug_a: "drug_quinine",
    drug_b: "drug_digoxin",
    severity: "major",
    description:
      "Quinine increases digoxin plasma concentration, raising the risk of digoxin toxicity in a drug with a narrow therapeutic index.",
    referenceSource:
      "FDA quinine sulfate label, Drug Interactions table: \"Digoxin — Increased digoxin plasma concentration\" (via openFDA).",
  },
  {
    id: "int_quinine_carbamazepine",
    drug_a: "drug_quinine",
    drug_b: "drug_carbamazepine",
    severity: "moderate",
    description:
      "Carbamazepine (a CYP3A4 inducer) can lower plasma quinine concentration, risking reduced antimalarial efficacy and treatment failure.",
    referenceSource:
      "FDA quinine sulfate label, Drug Interactions: CYP3A4 inducers/inhibitors cause \"alteration in plasma quinine concentration — monitor for lack of efficacy or increased adverse events\"; carbamazepine explicitly listed among interacting antiepileptics (via openFDA).",
  },
  {
    id: "int_digoxin_simvastatin",
    drug_a: "drug_digoxin",
    drug_b: "drug_simvastatin",
    severity: "moderate",
    description: "Simvastatin may raise digoxin plasma levels — monitor for signs of digoxin toxicity.",
    referenceSource:
      "FDA simvastatin label, Drug Interactions: \"Digoxin — During simvastatin initiation, monitor digoxin levels\"; \"Concomitant use of digoxin with simvastatin may result in elevated digoxin levels\" (via openFDA).",
  },
  {
    id: "int_digoxin_atorvastatin",
    drug_a: "drug_digoxin",
    drug_b: "drug_atorvastatin",
    severity: "moderate",
    description: "Atorvastatin may raise digoxin plasma levels — monitor for signs of digoxin toxicity.",
    referenceSource:
      "FDA atorvastatin label, Drug Interactions: \"Digoxin — May increase digoxin plasma levels; monitor patients appropriately\" (via openFDA).",
  },
  {
    id: "int_warfarin_simvastatin",
    drug_a: "drug_warfarin",
    drug_b: "drug_simvastatin",
    severity: "moderate",
    description: "Statins can potentiate warfarin's anticoagulant effect — monitor INR during initiation or dose changes.",
    referenceSource:
      "FDA simvastatin label, Drug Interactions: \"evident bleeding and/or increased INR in patients taking concomitant statins and warfarin\"; obtain an INR before starting simvastatin in patients taking coumarin anticoagulants (via openFDA).",
  },
  {
    id: "int_glibenclamide_atenolol",
    drug_a: "drug_glibenclamide",
    drug_b: "drug_atenolol",
    severity: "major",
    description:
      "Beta-blockers can both potentiate glibenclamide's hypoglycemic effect and mask the warning symptoms (tremor, palpitations) that would normally signal hypoglycemia.",
    referenceSource:
      "FDA glyburide label (glyburide is the US name for glibenclamide): \"Hypoglycemia may be difficult to recognize...in people who are taking beta-adrenergic blocking drugs\"; beta adrenergic blocking agents separately listed among drugs requiring close observation for hypoglycemia when combined with glyburide (via openFDA).",
  },
  {
    id: "int_glibenclamide_bisoprolol",
    drug_a: "drug_glibenclamide",
    drug_b: "drug_bisoprolol",
    severity: "major",
    description:
      "Beta-blockers can both potentiate glibenclamide's hypoglycemic effect and mask the warning symptoms (tremor, palpitations) that would normally signal hypoglycemia.",
    referenceSource:
      "FDA glyburide label (glyburide is the US name for glibenclamide): \"Hypoglycemia may be difficult to recognize...in people who are taking beta-adrenergic blocking drugs\"; beta adrenergic blocking agents separately listed among drugs requiring close observation for hypoglycemia when combined with glyburide (via openFDA).",
  },
  // The pairs below fill a second coverage gap, found the same way as the
  // carbamazepine/tramadol/morphine batch above: the formulary grew (SSRIs,
  // lithium, further anticonvulsants, verapamil, clopidogrel, tetracyclines)
  // without a matching pass over their interactions. Same sourcing standard —
  // direct FDA label quotes via openFDA, no inference — with one scope note:
  // several entries below cite one drug's label describing a named
  // serotonergic/interacting-drug list (e.g. fluoxetine's label naming
  // "tramadol" and "tricyclic antidepressants" under Serotonergic Agents) the
  // same way int_tramadol_diazepam etc. above already treat a single label's
  // named-class mention as sufficient — not "confirmed bidirectionally," but
  // not an inference either, since the interacting drug is named explicitly.
  {
    id: "int_fluoxetine_tramadol",
    drug_a: "drug_fluoxetine",
    drug_b: "drug_tramadol",
    severity: "major",
    description:
      "Combining an SSRI with tramadol raises the risk of serotonin syndrome, and separately lowers the seizure threshold, compounding tramadol's own seizure risk.",
    referenceSource:
      "FDA fluoxetine label, Warnings and Precautions (Serotonergic Agents): tramadol explicitly named among drugs that may interact with fluoxetine to increase serotonin syndrome risk, alongside \"triptans, tricyclic antidepressants, fentanyl, lithium...tryptophan, buspirone, amphetamines, and St. John's Wort\" (via openFDA).",
  },
  {
    id: "int_fluoxetine_warfarin",
    drug_a: "drug_fluoxetine",
    drug_b: "drug_warfarin",
    severity: "major",
    description: "SSRIs can potentiate warfarin's anticoagulant effect and independently raise bleeding risk — monitor INR closely.",
    referenceSource:
      "FDA fluoxetine label, Warnings and Precautions (Abnormal Bleeding), verbatim: \"Concomitant use of aspirin, nonsteroidal anti-inflammatory drugs, warfarin, and other anti-coagulants may add to this risk\" of bleeding (via openFDA).",
  },
  {
    id: "int_fluoxetine_aspirin",
    drug_a: "drug_fluoxetine",
    drug_b: "drug_aspirin",
    severity: "moderate",
    description: "SSRIs combined with NSAIDs/aspirin increase the risk of gastrointestinal and other bleeding.",
    referenceSource:
      "FDA fluoxetine label, Warnings and Precautions (Abnormal Bleeding), verbatim: \"Concomitant use of aspirin, nonsteroidal anti-inflammatory drugs, warfarin, and other anti-coagulants may add to this risk\" of bleeding (via openFDA).",
  },
  {
    id: "int_fluoxetine_amitriptyline",
    drug_a: "drug_fluoxetine",
    drug_b: "drug_amitriptyline",
    severity: "major",
    description:
      "Fluoxetine inhibits tricyclic antidepressant metabolism, raising amitriptyline plasma levels, and separately increases serotonin syndrome risk when the two are combined.",
    referenceSource:
      "FDA fluoxetine label: \"Dosage of a TCA may need to be reduced, and plasma TCA concentrations may need to be monitored temporarily when fluoxetine is coadministered\"; tricyclic antidepressants separately named under Serotonergic Agents (via openFDA).",
  },
  {
    id: "int_sertraline_tramadol",
    drug_a: "drug_sertraline",
    drug_b: "drug_tramadol",
    severity: "major",
    description:
      "Combining an SSRI with tramadol raises the risk of serotonin syndrome, and separately lowers the seizure threshold, compounding tramadol's own seizure risk.",
    referenceSource:
      "FDA sertraline hydrochloride label, Drug Interactions (Serotonergic Drugs): tramadol explicitly named among drugs that increase serotonin syndrome risk when combined with sertraline (via openFDA).",
  },
  {
    id: "int_sertraline_warfarin",
    drug_a: "drug_sertraline",
    drug_b: "drug_warfarin",
    severity: "major",
    description: "SSRIs can potentiate warfarin's anticoagulant effect and independently raise bleeding risk — monitor INR closely.",
    referenceSource:
      "FDA sertraline hydrochloride label, Drug Interactions: a clinical study comparing prothrombin time with concomitant sertraline vs. placebo found \"a mean increase in prothrombin time of 8% relative to baseline for sertraline hydrochloride compared to a 1% decrease for placebo\"; the label advises prothrombin time \"should be carefully monitored when sertraline hydrochloride therapy is initiated or stopped\" (via openFDA).",
  },
  {
    id: "int_citalopram_tramadol",
    drug_a: "drug_citalopram",
    drug_b: "drug_tramadol",
    severity: "major",
    description:
      "Combining an SSRI with tramadol raises the risk of serotonin syndrome, and separately lowers the seizure threshold, compounding tramadol's own seizure risk.",
    referenceSource:
      "FDA citalopram label, Drug Interactions: \"Concomitant use of citalopram and other serotonergic drugs (including...opioids...) increases the risk of serotonin syndrome\", with tramadol specifically listed among the named serotonergic opioids (via openFDA).",
  },
  {
    id: "int_citalopram_warfarin",
    drug_a: "drug_citalopram",
    drug_b: "drug_warfarin",
    severity: "major",
    description: "SSRIs can potentiate warfarin's anticoagulant effect and independently raise bleeding risk — monitor INR closely.",
    referenceSource:
      "FDA citalopram label, Drug Interactions, verbatim: \"For patients taking warfarin, carefully monitor the international normalized ratio\"; also \"Concomitant use of citalopram and an antiplatelet or anticoagulant may potentiate the risk of bleeding\" (via openFDA).",
  },
  {
    id: "int_lithium_hydrochlorothiazide",
    drug_a: "drug_lithium",
    drug_b: "drug_hydrochlorothiazide",
    severity: "major",
    description:
      "Thiazide diuretics reduce lithium's renal clearance, raising serum lithium concentrations and the risk of lithium toxicity — a narrow-therapeutic-index drug.",
    referenceSource:
      "Confirmed on both sides: FDA lithium carbonate label, Drug Interactions, verbatim: \"Diuretic-induced sodium loss may reduce lithium clearance and increase serum lithium concentrations\"; FDA lisinopril/hydrochlorothiazide combination label separately states \"Lithium - should not generally be given with diuretics. Diuretic agents reduce the renal clearance of lithium and add a high risk of lithium toxicity\" (via openFDA).",
  },
  {
    id: "int_lithium_bendroflumethiazide",
    drug_a: "drug_lithium",
    drug_b: "drug_bendroflumethiazide",
    severity: "major",
    description:
      "Thiazide diuretics reduce lithium's renal clearance, raising serum lithium concentrations and the risk of lithium toxicity — a narrow-therapeutic-index drug.",
    referenceSource:
      "FDA lithium carbonate label, Drug Interactions, verbatim: \"Diuretic-induced sodium loss may reduce lithium clearance and increase serum lithium concentrations\" — a class-wide statement about diuretics, of which bendroflumethiazide is a thiazide member (via openFDA).",
  },
  {
    id: "int_lithium_furosemide",
    drug_a: "drug_lithium",
    drug_b: "drug_furosemide",
    severity: "major",
    description:
      "Diuretic-induced sodium loss reduces lithium's renal clearance, raising serum lithium concentrations and the risk of lithium toxicity — a narrow-therapeutic-index drug.",
    referenceSource:
      "FDA lithium carbonate label, Drug Interactions, verbatim: \"Diuretic-induced sodium loss may reduce lithium clearance and increase serum lithium concentrations\", listing \"diuretics\" generally as a class requiring frequent lithium-level monitoring (via openFDA).",
  },
  {
    id: "int_lithium_lisinopril",
    drug_a: "drug_lithium",
    drug_b: "drug_lisinopril",
    severity: "major",
    description:
      "ACE inhibitors reduce lithium's renal clearance, raising serum lithium concentrations and the risk of lithium toxicity — a narrow-therapeutic-index drug.",
    referenceSource:
      "Confirmed on both sides: FDA lithium carbonate label lists \"Renin-Angiotensin System Antagonists\" as increasing steady-state serum lithium concentrations; FDA lisinopril label separately states \"Lithium toxicity has been reported in patients receiving lithium concomitantly with drugs which cause elimination of sodium, including ACE inhibitors\", recommending frequent serum lithium monitoring (via openFDA).",
  },
  {
    id: "int_lithium_enalapril",
    drug_a: "drug_lithium",
    drug_b: "drug_enalapril",
    severity: "major",
    description:
      "ACE inhibitors reduce lithium's renal clearance, raising serum lithium concentrations and the risk of lithium toxicity — a narrow-therapeutic-index drug.",
    referenceSource:
      "FDA lithium carbonate label, Drug Interactions: \"Renin-Angiotensin System Antagonists\" (a class that includes ACE inhibitors such as enalapril) listed as increasing steady-state serum lithium concentrations, with a recommendation to monitor serum lithium levels frequently (via openFDA).",
  },
  {
    id: "int_lithium_ibuprofen",
    drug_a: "drug_lithium",
    drug_b: "drug_ibuprofen",
    severity: "major",
    description:
      "NSAIDs reduce renal lithium clearance, raising serum lithium concentrations and the risk of lithium toxicity — a narrow-therapeutic-index drug.",
    referenceSource:
      "FDA lithium carbonate label, Drug Interactions, verbatim: \"NSAID decrease renal blood flow, resulting in decreased renal clearance and increased serum lithium concentrations\" (via openFDA).",
  },
  {
    id: "int_phenytoin_warfarin",
    drug_a: "drug_phenytoin",
    drug_b: "drug_warfarin",
    severity: "moderate",
    description:
      "Phenytoin can unpredictably increase or decrease warfarin's anticoagulant effect — monitor INR closely whenever either drug is started, stopped, or dose-adjusted.",
    referenceSource:
      "FDA phenytoin label, Drug Interactions, verbatim: \"Increased and decreased PT/INR responses have been reported when phenytoin is coadministered with warfarin\" (via openFDA).",
  },
  {
    id: "int_phenytoin_doxycycline",
    drug_a: "drug_phenytoin",
    drug_b: "drug_doxycycline",
    severity: "moderate",
    description: "Phenytoin induces metabolism of doxycycline, potentially reducing antibiotic efficacy and risking treatment failure.",
    referenceSource:
      "FDA doxycycline label, Drug Interactions, verbatim: \"Barbiturates, carbamazepine, and phenytoin decrease the half-life of doxycycline\" (via openFDA).",
  },
  {
    id: "int_lamotrigine_sodium_valproate",
    drug_a: "drug_lamotrigine",
    drug_b: "drug_sodium_valproate",
    severity: "severe",
    description:
      "Valproate markedly inhibits lamotrigine metabolism, raising lamotrigine levels and substantially increasing the risk of serious, potentially life-threatening skin rash (including Stevens-Johnson syndrome) unless the lamotrigine dose is reduced accordingly.",
    referenceSource:
      "FDA lamotrigine label, Boxed Warning, names \"coadministration of lamotrigine with valproate\" as a factor that increases serious-rash risk; Drug Interactions section states \"Valproate has been shown to inhibit glucuronidation and decrease the apparent clearance of lamotrigine\", such that \"the dosage of lamotrigine in the presence of valproate is less than half of that required in its absence\" (via openFDA).",
  },
  {
    id: "int_verapamil_atenolol",
    drug_a: "drug_verapamil",
    drug_b: "drug_atenolol",
    severity: "major",
    description:
      "Combining verapamil with a beta-blocker has additive effects on heart rate, AV conduction, and cardiac contractility, risking serious bradycardia or heart block.",
    referenceSource:
      "FDA verapamil label, Drug Interactions, verbatim: \"Concomitant therapy with beta-adrenergic blockers and verapamil may result in additive negative effects on heart rate, atrioventricular conduction and/or cardiac contractility\"; combined therapy \"should usually be avoided in patients with atrioventricular conduction abnormalities and those with depressed left ventricular function\" (via openFDA).",
  },
  {
    id: "int_verapamil_bisoprolol",
    drug_a: "drug_verapamil",
    drug_b: "drug_bisoprolol",
    severity: "major",
    description:
      "Combining verapamil with a beta-blocker has additive effects on heart rate, AV conduction, and cardiac contractility, risking serious bradycardia or heart block.",
    referenceSource:
      "FDA verapamil label, Drug Interactions, verbatim: \"Concomitant therapy with beta-adrenergic blockers and verapamil may result in additive negative effects on heart rate, atrioventricular conduction and/or cardiac contractility\" (via openFDA).",
  },
  {
    id: "int_verapamil_metoprolol",
    drug_a: "drug_verapamil",
    drug_b: "drug_metoprolol",
    severity: "major",
    description:
      "Combining verapamil with a beta-blocker has additive effects on heart rate, AV conduction, and cardiac contractility, risking serious bradycardia or heart block.",
    referenceSource:
      "FDA verapamil label, Drug Interactions, verbatim: \"Concomitant therapy with beta-adrenergic blockers and verapamil may result in additive negative effects on heart rate, atrioventricular conduction and/or cardiac contractility\" (via openFDA).",
  },
  {
    id: "int_verapamil_digoxin",
    drug_a: "drug_verapamil",
    drug_b: "drug_digoxin",
    severity: "major",
    description: "Verapamil can raise digoxin plasma levels substantially, risking digoxin toxicity in a narrow-therapeutic-index drug.",
    referenceSource:
      "FDA verapamil label, Drug Interactions, verbatim: \"chronic verapamil treatment can increase serum digoxin levels by 50% to 75% during the first week of therapy, and this can result in digitalis toxicity\"; maintenance/digitalization doses \"should be reduced when verapamil is administered\" (via openFDA).",
  },
  {
    id: "int_verapamil_simvastatin",
    drug_a: "drug_verapamil",
    drug_b: "drug_simvastatin",
    severity: "moderate",
    description: "Verapamil inhibits simvastatin metabolism (CYP3A4), raising the risk of myopathy — the simvastatin dose should be capped.",
    referenceSource:
      "FDA verapamil label, Drug Interactions, verbatim: \"Limit the dose of simvastatin in patients on verapamil to 10 mg daily\"; combined use of CYP3A4-substrate statins with verapamil \"has been associated with reports of myopathy/rhabdomyolysis\" (via openFDA).",
  },
  {
    id: "int_clopidogrel_omeprazole",
    drug_a: "drug_clopidogrel",
    drug_b: "drug_omeprazole",
    severity: "major",
    description:
      "Omeprazole inhibits the CYP2C19-mediated activation of clopidogrel, significantly reducing its antiplatelet effect — use a different acid-suppressing agent where possible.",
    referenceSource:
      "FDA clopidogrel label, Drug Interactions, verbatim: \"Avoid concomitant use of clopidogrel with omeprazole or esomeprazole\", since \"omeprazole was shown to reduce significantly the antiplatelet activity of clopidogrel when given concomitantly or 12 hours apart\"; the label notes \"dexlansoprazole, lansoprazole, and pantoprazole had less effect\" (via openFDA).",
  },
  {
    id: "int_doxycycline_ferrous_sulfate",
    drug_a: "drug_doxycycline",
    drug_b: "drug_ferrous_sulfate",
    severity: "moderate",
    description:
      "Iron salts bind tetracyclines in the gut and reduce their absorption, risking treatment failure. Manageable by spacing doses several hours apart.",
    referenceSource:
      "FDA doxycycline label, Drug Interactions, verbatim: \"Absorption of tetracyclines is impaired by antacids containing aluminum, calcium, or magnesium, and iron-containing preparations\" (via openFDA).",
  },
  {
    id: "int_doxycycline_ferrous_fumarate",
    drug_a: "drug_doxycycline",
    drug_b: "drug_ferrous_fumarate",
    severity: "moderate",
    description:
      "Iron salts bind tetracyclines in the gut and reduce their absorption, risking treatment failure. Manageable by spacing doses several hours apart.",
    referenceSource:
      "FDA doxycycline label, Drug Interactions, verbatim: \"Absorption of tetracyclines is impaired by antacids containing aluminum, calcium, or magnesium, and iron-containing preparations\" (via openFDA).",
  },
  {
    id: "int_tetracycline_ferrous_sulfate",
    drug_a: "drug_tetracycline",
    drug_b: "drug_ferrous_sulfate",
    severity: "moderate",
    description:
      "Iron salts bind tetracyclines in the gut and reduce their absorption, risking treatment failure. Manageable by spacing doses several hours apart.",
    referenceSource:
      "FDA doxycycline label, Drug Interactions, verbatim: \"Absorption of tetracyclines is impaired by...iron-containing preparations\" — a class-wide tetracycline statement, applied here to tetracycline itself (via openFDA).",
  },
  {
    id: "int_doxycycline_warfarin",
    drug_a: "drug_doxycycline",
    drug_b: "drug_warfarin",
    severity: "moderate",
    description: "Tetracyclines can depress plasma prothrombin activity, potentiating warfarin's anticoagulant effect — monitor INR and anticoagulant dose.",
    referenceSource:
      "FDA doxycycline label, Drug Interactions, verbatim: \"Because tetracyclines have been shown to depress plasma prothrombin activity, patients who are on anticoagulant therapy may require downward adjustment of their anticoagulant dosage\" (via openFDA).",
  },
];
