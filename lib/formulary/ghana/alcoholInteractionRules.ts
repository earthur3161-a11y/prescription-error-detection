import type { AlcoholInteractionRule } from "../../types";

/**
 * Drug-alcohol interaction reference data. Same sourcing methodology and
 * completeness bar as foodInteractionRules.ts — see that file's header for
 * the full methodology note (FDA labels as primary source, PubMed/NCBI
 * cross-reference, class-level extensions marked as such, not Ghana-specific
 * since this is general pharmacology, not exhaustive over all 144 drugs).
 *
 * One item worth flagging explicitly: the metronidazole/tinidazole/
 * secnidazole "disulfiram-like reaction" warning is still current FDA
 * label guidance, but a 2023 case-control study (Cain et al., PubMed
 * 37494646) found controlled experimental data do not support metronidazole
 * actually raising acetaldehyde or reliably producing the reaction — the
 * mechanism is now scientifically contested. The label hasn't been updated
 * to reflect this. These three entries follow the current, still-in-force
 * FDA label (the standard of care until it changes) rather than the
 * contested newer research, and that tension is real, not an oversight.
 */

export const ghanaAlcoholInteractionRules: AlcoholInteractionRule[] = [
  {
    id: "alc_metronidazole_disulfiram",
    drug_id: "drug_metronidazole",
    severity: "moderate",
    description:
      "FDA labeling warns of a disulfiram-like reaction with alcohol (flushing, nausea, vomiting, headache, cramps) — see this file's header for a note on contested recent evidence about the underlying mechanism.",
    guidance: "Avoid alcohol during treatment and for 72 hours after the last dose, per current FDA labeling.",
    referenceSource: "FDA metronidazole (FLAGYL) label — advises avoiding alcohol during and 72h after treatment.",
  },
  {
    id: "alc_tinidazole_disulfiram",
    drug_id: "drug_tinidazole",
    severity: "moderate",
    description: "Class-level nitroimidazole finding — same disulfiram-like reaction warning as metronidazole; see this file's header note on the underlying mechanism.",
    guidance: "Avoid alcohol during treatment and for 72 hours after the last dose.",
    referenceSource: "Class extension from FDA metronidazole labeling — shared nitroimidazole mechanism.",
  },
  {
    id: "alc_secnidazole_disulfiram",
    drug_id: "drug_secnidazole",
    severity: "moderate",
    description: "Class-level nitroimidazole finding — see tinidazole entry.",
    guidance: "Avoid alcohol during treatment and for 72 hours after the last dose.",
    referenceSource: "Class extension from FDA metronidazole labeling — shared nitroimidazole mechanism.",
  },
  {
    id: "alc_diazepam_cns_depression",
    drug_id: "drug_diazepam",
    severity: "major",
    description: "Additive CNS depression — combinations of benzodiazepines with alcohol can cause severe sedation, respiratory depression, coma, or death.",
    guidance: "Alcohol should not be used during treatment with this drug.",
    referenceSource: "FDA benzodiazepine class labeling on CNS-depressant additive effects with alcohol.",
  },
  {
    id: "alc_clonazepam_cns_depression",
    drug_id: "drug_clonazepam",
    severity: "major",
    description: "Class-level benzodiazepine finding — see diazepam entry.",
    guidance: "Alcohol should not be used during treatment with this drug.",
    referenceSource: "Class extension — FDA benzodiazepine class labeling on CNS-depressant additive effects.",
  },
  {
    id: "alc_lorazepam_cns_depression",
    drug_id: "drug_lorazepam",
    severity: "major",
    description: "Class-level benzodiazepine finding — see diazepam entry.",
    guidance: "Alcohol should not be used during treatment with this drug.",
    referenceSource: "Class extension — FDA benzodiazepine class labeling on CNS-depressant additive effects.",
  },
  {
    id: "alc_tramadol_respiratory_depression",
    drug_id: "drug_tramadol",
    severity: "severe",
    description: "Concomitant alcohol use significantly increases the risk of profound sedation, respiratory depression, coma, and death — pharmacovigilance data specifically implicate this combination.",
    guidance: "Avoid alcohol entirely while taking this drug.",
    referenceSource: "FDA tramadol label — explicit warning on concomitant CNS depressants including alcohol; pharmacovigilance (VigiBase) respiratory-depression risk-factor data.",
  },
  {
    id: "alc_morphine_respiratory_depression",
    drug_id: "drug_morphine",
    severity: "severe",
    description: "Class-level opioid finding — same additive respiratory-depression risk as tramadol; this is one of the most consistently documented drug-alcohol interactions across all opioids.",
    guidance: "Avoid alcohol entirely while taking this drug.",
    referenceSource: "Class extension — FDA opioid-analgesic class labeling on CNS-depressant/alcohol interactions.",
  },
  {
    id: "alc_codeine_respiratory_depression",
    drug_id: "drug_codeine",
    severity: "severe",
    description: "Class-level opioid finding — see morphine entry.",
    guidance: "Avoid alcohol entirely while taking this drug.",
    referenceSource: "Class extension — FDA opioid-analgesic class labeling on CNS-depressant/alcohol interactions.",
  },
  {
    id: "alc_pethidine_respiratory_depression",
    drug_id: "drug_pethidine",
    severity: "severe",
    description: "Class-level opioid finding — see morphine entry.",
    guidance: "Avoid alcohol entirely while taking this drug.",
    referenceSource: "Class extension — FDA opioid-analgesic class labeling on CNS-depressant/alcohol interactions.",
  },
  {
    id: "alc_paracetamol_chronic_heavy_use",
    drug_id: "drug_paracetamol",
    severity: "moderate",
    description: "FDA labeling specifically targets chronic heavy alcohol use (3+ drinks/day), not moderate/occasional use — evidence for increased hepatotoxicity at therapeutic paracetamol doses in chronic drinkers is described as limited, but the FDA warning remains current.",
    guidance: "If you drink 3 or more alcoholic drinks every day, ask a doctor or pharmacist before taking this drug — this is not a caution against occasional/moderate alcohol use.",
    referenceSource: "FDA-mandated acetaminophen label warning — the \"3 or more alcoholic drinks every day\" threshold is the FDA's own wording.",
  },
  {
    id: "alc_glibenclamide_hypoglycemia",
    drug_id: "drug_glibenclamide",
    severity: "moderate",
    description: "Alcohol inhibits hepatic gluconeogenesis, compounding sulfonylurea-induced insulin release — hypoglycemia can be prolonged and delayed after drinking.",
    guidance: "Limit or avoid alcohol; be aware hypoglycemia can be delayed, not just immediate.",
    referenceSource: "Clinical literature on sulfonylurea-alcohol hypoglycemia risk (hepatic gluconeogenesis inhibition).",
  },
  {
    id: "alc_gliclazide_hypoglycemia",
    drug_id: "drug_gliclazide",
    severity: "moderate",
    description: "Class-level sulfonylurea finding — see glibenclamide entry.",
    guidance: "Limit or avoid alcohol; be aware hypoglycemia can be delayed, not just immediate.",
    referenceSource: "Class extension — sulfonylurea/alcohol hypoglycemia mechanism.",
  },
  {
    id: "alc_glimepiride_hypoglycemia",
    drug_id: "drug_glimepiride",
    severity: "moderate",
    description: "Class-level sulfonylurea finding — see glibenclamide entry.",
    guidance: "Limit or avoid alcohol; be aware hypoglycemia can be delayed, not just immediate.",
    referenceSource: "Class extension — sulfonylurea/alcohol hypoglycemia mechanism.",
  },
  {
    id: "alc_metformin_lactic_acidosis",
    drug_id: "drug_metformin",
    severity: "severe",
    description: "Alcohol potentiates metformin's effect on lactate metabolism, increasing the risk of lactic acidosis — a rare but potentially fatal complication and an FDA black-box-level concern.",
    guidance: "Avoid excessive alcohol intake, both acute (binge) and chronic, while taking this drug.",
    referenceSource: "FDA metformin label — black box warning identifies excessive alcohol intake as a lactic-acidosis risk factor.",
  },
  {
    id: "alc_amitriptyline_cns_depression",
    drug_id: "drug_amitriptyline",
    severity: "major",
    description: "Tricyclic antidepressants can enhance the CNS-depressant response to alcohol, increasing sedation and, at the extreme, respiratory depression risk.",
    guidance: "Avoid alcohol or discuss safe limits with a prescriber.",
    referenceSource: "Amitriptyline prescribing information and CNS-depressant interaction literature.",
  },
  {
    id: "alc_chlorpromazine_sedation",
    drug_id: "drug_chlorpromazine",
    severity: "moderate",
    description: "Antipsychotics combined with alcohol magnify sedation and can impair coordination and breathing; chlorpromazine is the most sedating of the antipsychotics in this formulary via H1-histamine blockade.",
    guidance: "Avoid alcohol or discuss safe limits with a prescriber.",
    referenceSource: "Clinical literature on antipsychotic-alcohol CNS depression/sedation.",
  },
  {
    id: "alc_haloperidol_sedation",
    drug_id: "drug_haloperidol",
    severity: "moderate",
    description: "Class-level antipsychotic finding — less sedating than chlorpromazine, but the same additive-CNS-depression caution applies.",
    guidance: "Avoid alcohol or discuss safe limits with a prescriber.",
    referenceSource: "Class extension — antipsychotic-alcohol CNS depression literature.",
  },
  {
    id: "alc_olanzapine_sedation",
    drug_id: "drug_olanzapine",
    severity: "moderate",
    description: "Class-level antipsychotic finding — olanzapine is relatively sedating among atypical antipsychotics; same additive-CNS-depression caution.",
    guidance: "Avoid alcohol or discuss safe limits with a prescriber.",
    referenceSource: "Class extension — antipsychotic-alcohol CNS depression literature.",
  },
  {
    id: "alc_risperidone_sedation",
    drug_id: "drug_risperidone",
    severity: "moderate",
    description: "Class-level antipsychotic finding — same additive-CNS-depression caution as the rest of the class.",
    guidance: "Avoid alcohol or discuss safe limits with a prescriber.",
    referenceSource: "Class extension — antipsychotic-alcohol CNS depression literature.",
  },
  {
    id: "alc_aspirin_gi_bleeding",
    drug_id: "drug_aspirin",
    severity: "moderate",
    description: "Alcohol and NSAIDs/aspirin independently irritate the GI mucosa and impair its protective prostaglandin-mediated defenses; combined use increases upper-GI bleeding risk, worse with heavier/chronic drinking.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "FDA guidance and case-control literature on NSAID/aspirin + alcohol GI bleeding risk.",
  },
  {
    id: "alc_ibuprofen_gi_bleeding",
    drug_id: "drug_ibuprofen",
    severity: "moderate",
    description: "Class-level NSAID finding — FDA advisory committees concluded the alcohol/ibuprofen GI effect is at least additive, with heavy/chronic drinkers at increased risk.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "FDA NSAID class guidance on alcohol-related GI risk.",
  },
  {
    id: "alc_diclofenac_gi_bleeding",
    drug_id: "drug_diclofenac",
    severity: "moderate",
    description: "Class-level NSAID finding — diclofenac specifically shown to carry a moderate increase in GI bleeding risk, compounded by alcohol use.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "Class extension plus diclofenac-specific GI-bleeding-risk literature.",
  },
  {
    id: "alc_naproxen_gi_bleeding",
    drug_id: "drug_naproxen",
    severity: "moderate",
    description: "Class-level NSAID finding — same COX-inhibition/GI-mucosal mechanism as the rest of the class.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "Class extension — NSAID/alcohol GI bleeding mechanism.",
  },
  {
    id: "alc_mefenamic_acid_gi_bleeding",
    drug_id: "drug_mefenamic_acid",
    severity: "moderate",
    description: "Class-level NSAID finding — see naproxen entry.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "Class extension — NSAID/alcohol GI bleeding mechanism.",
  },
  {
    id: "alc_celecoxib_gi_bleeding",
    drug_id: "drug_celecoxib",
    severity: "minor",
    description: "COX-2-selective, so baseline GI risk is lower than non-selective NSAIDs by design — included at a lower severity than the rest of the class since no celecoxib-specific alcohol study was located; this is a cautious, not confirmed-strength, class extension.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "Cautious class extension — general NSAID/alcohol GI mechanism, tempered for COX-2 selectivity; no celecoxib-specific citation found.",
  },
  {
    id: "alc_prednisolone_gi_irritation",
    drug_id: "drug_prednisolone",
    severity: "moderate",
    description: "Oral corticosteroids independently increase GI bleeding/ulcer risk (roughly 4x higher hospitalization rate for upper GI bleeding is reported); alcohol's own mucosal irritation is additive/synergistic with this.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "Clinical literature on oral corticosteroid GI risk and alcohol interaction.",
  },
  {
    id: "alc_dexamethasone_gi_irritation",
    drug_id: "drug_dexamethasone",
    severity: "moderate",
    description: "Class-level oral/systemic corticosteroid finding — see prednisolone entry.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "Class extension — oral corticosteroid/alcohol GI mucosal irritation mechanism.",
  },
  {
    id: "alc_hydrocortisone_gi_irritation",
    drug_id: "drug_hydrocortisone",
    severity: "minor",
    description: "Class-level oral/systemic corticosteroid finding, at a lower severity than prednisolone/dexamethasone since hydrocortisone in this formulary is more often used at physiologic/replacement doses rather than higher anti-inflammatory doses. Does NOT apply to the inhaled corticosteroids in this formulary (budesonide, fluticasone, beclometasone) — see excluded list.",
    guidance: "Limit alcohol, especially with regular or long-duration use of this drug.",
    referenceSource: "Class extension — oral corticosteroid/alcohol GI mucosal irritation mechanism.",
  },
];

export const alcoholInteractionExcluded: { candidate: string; reason: string }[] = [
  { candidate: "Inhaled corticosteroids (budesonide, fluticasone, beclometasone) + alcohol", reason: "The oral/systemic corticosteroid GI-irritation mechanism (see prednisolone/dexamethasone/hydrocortisone entries) does not transfer to inhaled routes, which have minimal systemic absorption. Confirmed the interaction genuinely doesn't apply to this route, not a sourcing gap." },
];
