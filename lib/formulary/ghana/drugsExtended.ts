import type { Drug } from "../../types";

/**
 * Additional commonly-dispensed medicines in Ghana, layered on top of the core
 * list in `drugs.ts` so drug search feels comprehensive rather than limited to
 * the Essential Medicines List subset.
 *
 * `standard_dose_range` and each drug's EML status (applied via `NOT_ON_EML`
 * in `drugs.ts`) are sourced from the real, official Ghana Ministry of Health
 * documents — Standard Treatment Guidelines (STG) and Essential Medicines
 * List (EML), both 7th Edition 2017 — the same sourcing pass and citation
 * convention documented at the top of `drugs.ts`. Two drugs in this file
 * (Cephalexin, Loratadine) were searched for in both documents and are
 * confirmed genuinely absent from Ghana's national guidelines; they're kept
 * in the list (so search still finds them) but flagged as such in their own
 * comments and in `drugs.ts`'s `NOT_ON_EML` map, with their dosing left as
 * the original illustrative reference values since no Ghana-specific source
 * exists for them.
 *
 * `pregnancyCategory` / `renalDoseGuidance` / `hepaticDoseGuidance` and any
 * `contraindications` remain illustrative — no Ghana-specific source for
 * these exists (see the note in `drugs.ts`).
 */
export const ghanaDrugsExtended: Omit<Drug, "onEssentialMedicinesList" | "emlAlternativeDrugId">[] = [
  // --- Penicillins (share class "Penicillin" so allergy screening cross-matches) ---
  {
    id: "drug_co_amoxiclav",
    generic_name: "Amoxicillin-Clavulanate",
    brand_names: ["Augmentin", "Co-amoxiclav"],
    class: "Penicillin",
    // STG Ch.8 Pneumonia: adult "1g 12-hourly for 5-7 days". Paediatric,
    // age/weight-banded: >12y one 500/125 tablet 12-hourly; 4-12y 400/57
    // suspension; 1-4y 200/28 suspension; 3mo-1y 20mg/kg (of amoxicillin)
    // 12-hourly; <3mo 15mg/kg 12-hourly. STG note: double the dose for severe
    // infections (e.g. bronchopneumonia).
    standard_dose_range: { minMgPerDose: 375, maxMgPerDose: 1000, maxMgPerDay: 2000, frequency: "every 12h", weightBased: true, pediatric: { mgPerKgPerDose: 20, maxMgPerDose: 1000 } },
    route: ["oral", "IV"],
    region_availability: ["GH"],
    contraindications: ["History of penicillin anaphylaxis", "Amoxiclav-associated jaundice/hepatic dysfunction"],
  },
  {
    id: "drug_ampicillin",
    generic_name: "Ampicillin",
    brand_names: ["Penbritin"],
    class: "Penicillin",
    // STG mainly cites this for neonatal sepsis (Ch.6, combined with
    // Gentamicin): ">7 days old: 50mg/kg 8-hourly / <7 days old: 50mg/kg
    // 12-hourly, for 5-7 days". A general adult IV citation also exists (typhoid
    // chapter): "500mg 6-hourly".
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 2000, frequency: "every 6h", weightBased: true, pediatric: { mgPerKgPerDose: 50, maxMgPerDose: 500 } },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_cloxacillin",
    generic_name: "Cloxacillin",
    brand_names: ["Orbenin"],
    class: "Penicillin",
    // STG Ch.23 Acute Orthopaedic Infections, IV: adult "500mg 6-hourly for
    // 2-4 weeks"; paediatric age-banded "5-12y 250mg / 1-5y 125mg / <1y
    // 62.5mg" (all 6-hourly). Neonatal sepsis (Ch.6): 25-50mg/kg 8-12-hourly.
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 2000, frequency: "every 6h", weightBased: true, pediatric: { mgPerKgPerDose: 37.5, maxMgPerDose: 500 } },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_benzylpenicillin",
    generic_name: "Benzylpenicillin",
    brand_names: ["Crystapen", "Penicillin G"],
    class: "Penicillin",
    // STG Ch.5 Diphtheria: adult "1.2g 6-hourly for 48 hours"; paediatric
    // "1 month-18 years; 50mg/kg 6-hourly for 48 hours". (Tetanus chapter uses
    // a different, much higher regimen: 50,000 units/kg stat then 4 MU
    // 6-hourly for 5 days — reported here, not blended in.)
    standard_dose_range: { minMgPerDose: 600, maxMgPerDose: 1200, maxMgPerDay: 4800, frequency: "every 6h", weightBased: true, pediatric: { mgPerKgPerDose: 50, maxMgPerDose: 1200 } },
    route: ["IV", "IM"],
    region_availability: ["GH"],
  },

  // --- Cephalosporins (cross-reactive with penicillin allergy) ---
  {
    id: "drug_cefuroxime",
    generic_name: "Cefuroxime",
    brand_names: ["Zinnat"],
    class: "Cephalosporin",
    // STG Ch.3 Malnutrition: paediatric "IV 20mg/kg 8-hourly for 48-72 hours,
    // then oral 15mg/kg 12-hourly for 5-7 days" (ages 3mo-12y). Adult IV
    // citation (Ch.14/15, genitourinary): "750mg 8-hourly".
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 750, maxMgPerDay: 2250, frequency: "every 8h", weightBased: true, pediatric: { mgPerKgPerDose: 20, maxMgPerDose: 750 } },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_cefixime",
    generic_name: "Cefixime",
    brand_names: ["Suprax"],
    class: "Cephalosporin",
    // The only STG dosing found for this drug is single-dose STI syndromic
    // management (Ch.16, Gonorrhoea): "400mg stat." for adults and children
    // >12 years — no continuous/multi-day regimen was found in STG for other
    // indications.
    standard_dose_range: { minMgPerDose: 400, maxMgPerDose: 400, maxMgPerDay: 400, frequency: "single dose", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_cephalexin",
    // NOT FOUND in either Ghana STG or EML (7th Ed. 2017) — searched
    // "Cephalexin", "Cefalexin" (INN spelling), and "Keflex" against the full
    // text of both documents with no matches. Ghana's guidelines use
    // Cloxacillin/Cefuroxime/Cefixime instead. Kept in the search list (per
    // this file's purpose) with its original illustrative dosing, but flagged
    // as not-on-EML in drugs.ts's NOT_ON_EML map rather than defaulting to
    // "listed."
    generic_name: "Cephalexin",
    brand_names: ["Keflex", "Ceporex"],
    class: "Cephalosporin",
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 2000, frequency: "every 6h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },

  // --- Macrolides (share class so duplicate-therapy screening fires) ---
  {
    id: "drug_azithromycin",
    generic_name: "Azithromycin",
    brand_names: ["Zithromax", "Azithro"],
    class: "Macrolide",
    // STG Ch.8 Pneumonia: adult oral "500mg once daily for 3-7 days";
    // paediatric "10mg/kg once daily for 3-7 days" (IV route explicitly "not
    // recommended in children" for this indication).
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 500, frequency: "once daily", weightBased: true, pediatric: { mgPerKgPerDose: 10, maxMgPerDose: 500 } },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_erythromycin",
    generic_name: "Erythromycin",
    brand_names: ["Erythrocin"],
    class: "Macrolide",
    // STG Ch.1 Diarrhoea (cholera): adult "500mg 8-hourly for 5 days";
    // paediatric age-banded down to neonates "12.5mg/kg 6-hourly for 5 days".
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 1500, frequency: "every 8h", weightBased: true, pediatric: { mgPerKgPerDose: 12.5, maxMgPerDose: 500 } },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_clarithromycin",
    generic_name: "Clarithromycin",
    brand_names: ["Klaricid"],
    class: "Macrolide",
    // STG Ch.5 Pertussis, 2nd-line treatment: adult "500mg 12-hourly for 7
    // days"; paediatric "7.5mg/kg 12-hourly for 7 days".
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 1000, frequency: "every 12h", weightBased: true, pediatric: { mgPerKgPerDose: 7.5, maxMgPerDose: 500 } },
    route: ["oral"],
    region_availability: ["GH"],
  },

  // --- Other antimicrobials ---
  {
    id: "drug_doxycycline",
    generic_name: "Doxycycline",
    brand_names: ["Vibramycin"],
    class: "Tetracycline",
    // STG cholera (Ch.1): adult "100mg 12-hourly for 3 days" (children
    // explicitly "not recommended"). General STI use (Ch.16): "100mg
    // 12-hourly for 7 days"; explicitly "avoid in pregnant and lactating
    // mothers".
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 100, maxMgPerDay: 200, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy", "Children under 8 years"],
  },
  {
    id: "drug_nitrofurantoin",
    generic_name: "Nitrofurantoin",
    brand_names: ["Macrodantin"],
    class: "Nitrofuran",
    // STG Ch.14 Acute Cystitis: adult "100mg 6-hourly for 5-7 days";
    // paediatric "12-18y 50mg 6-hourly / 3mo-12y 750 micrograms/kg 6-hourly",
    // both for 7 days.
    standard_dose_range: { minMgPerDose: 50, maxMgPerDose: 100, maxMgPerDay: 400, frequency: "every 6h", weightBased: true, pediatric: { mgPerKgPerDose: 0.75, maxMgPerDose: 100 } },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Significant renal impairment", "Term pregnancy (38+ weeks)"],
  },
  {
    id: "drug_gentamicin",
    generic_name: "Gentamicin",
    brand_names: ["Cidomycin", "Genticyn"],
    class: "Aminoglycoside",
    // STG Ch.6 Sick Newborn (sepsis): "4mg/kg 24-hourly for 7 days,
    // irrespective of age after birth". Adult IV citation (obstetric sepsis,
    // Ch.13): "80mg 8-hourly for 5 days".
    standard_dose_range: { minMgPerDose: 60, maxMgPerDose: 120, maxMgPerDay: 240, frequency: "every 8h (or once daily by weight)", weightBased: true, pediatric: { mgPerKgPerDose: 4, maxMgPerDose: 120 } },
    route: ["IV", "IM"],
    region_availability: ["GH"],
    contraindications: ["Pre-existing renal impairment (relative)", "Myasthenia gravis"],
  },
  {
    id: "drug_levofloxacin",
    generic_name: "Levofloxacin",
    brand_names: ["Tavanic", "Levoflox"],
    class: "Fluoroquinolone",
    // STG Ch.14 Bacterial Prostatitis: adult oral "500mg once daily for 4-6
    // weeks" (IV: "500mg 12-hourly"). A separate, much higher weight-based
    // regimen (15-20mg/kg/day divided) exists specifically for drug-resistant
    // TB (Ch.18) — not a general-use dose, so not encoded here.
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 750, maxMgPerDay: 1000, frequency: "once daily", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_fluconazole",
    generic_name: "Fluconazole",
    brand_names: ["Diflucan"],
    class: "Azole Antifungal",
    // STG Ch.1 (oesophageal candidiasis): adult "200mg stat., then 100mg
    // daily for 14 days". Paediatric: 10mg/kg daily (febrile neutropenia,
    // Ch.6) or 3-6mg/kg stat. (children's candidiasis, Ch.16) depending on
    // indication.
    standard_dose_range: { minMgPerDose: 50, maxMgPerDose: 200, maxMgPerDay: 200, frequency: "once daily", weightBased: true, pediatric: { mgPerKgPerDose: 6, maxMgPerDose: 200 } },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_aciclovir",
    generic_name: "Aciclovir",
    brand_names: ["Zovirax"],
    class: "Antiviral",
    // STG Ch.11 Herpes Zoster Infections (severe cases), oral: adult "800mg
    // 4-hourly (5 times daily) for 5-7 days". Paediatric dosing is age-banded
    // (Herpes Simplex chapter: >2y 200mg, 1mo-2y 100mg, both 4-hourly 5x/day)
    // rather than a per-kg figure, so no `pediatric.mgPerKgPerDose` is set —
    // see STG for the age-band table. Topical 5% cream is dosed identically
    // (apply 5x daily) for milder cases.
    standard_dose_range: { minMgPerDose: 200, maxMgPerDose: 800, maxMgPerDay: 4000, frequency: "5 times daily", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },

  // --- Analgesics ---
  {
    id: "drug_naproxen",
    generic_name: "Naproxen",
    brand_names: ["Naprosyn"],
    class: "NSAID",
    // STG (Osteoarthritis, Back Pain, and several Trauma chapters), consistent
    // citation: "Naproxen EC, 250-500mg 12-hourly as required" — explicitly
    // "Children: Not indicated" for this adult formulation. A separate
    // weight-based paediatric dose exists specifically for Juvenile Idiopathic
    // Arthritis (Ch.22): ">5y 5-7.5mg/kg 12-hourly, max 1g/day; <5y not
    // recommended" — not encoded here since it's condition-specific, not
    // general-use.
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 1000, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active peptic ulcer", "Severe heart failure", "Third-trimester pregnancy"],
  },
  {
    id: "drug_tramadol",
    generic_name: "Tramadol",
    brand_names: ["Tramal"],
    class: "Opioid Analgesic",
    // STG Ch.26 Management of Acute Pain: adult "50-100mg 4-6-hourly (max
    // 400mg daily)"; paediatric (Headache chapter) ">12y same as adult range;
    // <12y not recommended" — so no pediatric field is set here.
    standard_dose_range: { minMgPerDose: 50, maxMgPerDose: 100, maxMgPerDay: 400, frequency: "every 4-6h", weightBased: false },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
    contraindications: ["Uncontrolled epilepsy", "Concurrent MAO inhibitors"],
  },
  {
    id: "drug_morphine",
    generic_name: "Morphine",
    brand_names: ["Oramorph", "MST"],
    class: "Opioid Analgesic",
    // STG Ch.23 Burns (a clean, unambiguous citation among many
    // condition-specific morphine doses across the document): adult IV
    // "2.5-5mg 4-hourly"; paediatric IV "0.1mg/kg (max 5mg) 4-hourly". Other
    // chapters (Acute Abdomen, Fractures) use "2-5mg 4-hourly" IV/IM with
    // paediatric "50-200 micrograms/kg 4-hourly" — broadly consistent with
    // the range used here.
    standard_dose_range: { minMgPerDose: 2.5, maxMgPerDose: 10, maxMgPerDay: 60, frequency: "every 4h", weightBased: true, pediatric: { mgPerKgPerDose: 0.1, maxMgPerDose: 5 } },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
    contraindications: ["Respiratory depression", "Acute severe asthma", "Paralytic ileus"],
  },

  // --- Cardiovascular ---
  {
    id: "drug_lisinopril",
    generic_name: "Lisinopril",
    brand_names: ["Zestril"],
    class: "ACE Inhibitor",
    // STG Ch.7, "51. Hypertension", 1st Line Treatment: "5-40mg daily". (The
    // Ischaemic Heart Disease/Heart Failure chapters use a lower "2.5-20mg
    // daily" range instead — reported here, not blended in.)
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 40, maxMgPerDay: 40, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy", "History of ACE-inhibitor angioedema", "Bilateral renal artery stenosis"],
  },
  {
    id: "drug_enalapril",
    generic_name: "Enalapril",
    brand_names: ["Renitec"],
    class: "ACE Inhibitor",
    // IMPORTANT — no adult dose for Enalapril was found anywhere in Ghana STG
    // (Lisinopril is the ACE inhibitor used in the adult Hypertension/
    // Ischaemic Heart Disease/Heart Failure chapters instead). The only STG
    // citation found is paediatric (Ch.7, "52. Hypertension in children and
    // adolescents"): "12-18y initial 2.5mg daily, increased to max 10-20mg
    // daily / 1mo-12y initial 100 micrograms/kg daily, increased to max 1mg/
    // kg daily / Neonate 10 micrograms/kg daily, increased to max 500
    // micrograms/kg daily". Adult figures below are kept at their prior
    // illustrative values since no STG-specific adult number could be
    // confirmed; the pediatric figure is real and sourced.
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 20, maxMgPerDay: 40, frequency: "once or twice daily", weightBased: true, pediatric: { mgPerKgPerDose: 0.1, maxMgPerDose: 20 } },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy", "History of ACE-inhibitor angioedema"],
  },
  {
    id: "drug_atenolol",
    generic_name: "Atenolol",
    brand_names: ["Tenormin"],
    class: "Beta Blocker",
    // STG Ch.7, "51. Hypertension", 1st Line Treatment: "50-100mg daily". (ACS
    // chapter uses a wider "25-100mg daily" range.) Paediatric, weight-based
    // (Hypertension in children): "0.5-1mg/kg daily, max 2mg/kg daily".
    standard_dose_range: { minMgPerDose: 25, maxMgPerDose: 100, maxMgPerDay: 100, frequency: "once daily", weightBased: true, pediatric: { mgPerKgPerDose: 0.75, maxMgPerDose: 100 } },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Asthma", "Second/third-degree heart block", "Severe bradycardia"],
  },
  {
    id: "drug_bisoprolol",
    generic_name: "Bisoprolol",
    brand_names: ["Concor"],
    class: "Beta Blocker",
    // STG Ch.7, "51. Hypertension", 1st Line Treatment: "5-20mg daily". (Heart
    // Failure chapter uses a lower "1.25-10mg daily" range; Angina "5-10mg
    // daily" — reported here, not blended in.) Paediatric: explicitly "safety
    // not established in children" (arrhythmia chapter).
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 20, maxMgPerDay: 20, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Asthma", "Second/third-degree heart block", "Acute decompensated heart failure"],
  },
  {
    id: "drug_nifedipine",
    generic_name: "Nifedipine",
    brand_names: ["Adalat"],
    class: "Calcium Channel Blocker",
    // STG Ch.7, "51. Hypertension", 1st Line: "Nifedipine retard, 10-40mg
    // 12-hourly". Paediatric, weight-based (Hypertension in children): "12-18y
    // 5-20mg 8-hourly / 1mo-12y 200-300 micrograms/kg 8-hourly (max 100mg
    // daily)". NOTE — a real, unresolved contradiction exists within STG
    // itself: sublingual nifedipine is explicitly prohibited in the Stroke
    // ("DO NOT USE SUBLINGUAL NIFEDIPINE") and Hypertensive Emergencies
    // chapters, but explicitly prescribed ("Nifedipine, sublingual, 10mg
    // stat.") in the Severe Pre-Eclampsia/Imminent Eclampsia chapter — both
    // passages quoted verbatim from the source document, not reconciled here.
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 40, maxMgPerDay: 80, frequency: "twice daily (sustained-release)", weightBased: true, pediatric: { mgPerKgPerDose: 0.25, maxMgPerDose: 100 } },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_methyldopa",
    generic_name: "Methyldopa",
    brand_names: ["Aldomet"],
    class: "Centrally-acting Antihypertensive",
    // STG Ch.13, Hypertension in Pregnancy (not associated with pre-eclampsia),
    // 1st Line Treatment: "250-500mg 8-12-hourly (max 2g daily)" — the same
    // figure repeats in the Pre-eclampsia chapter. The general adult
    // Hypertension chapter (Ch.7, 2nd line) allows a wider "250mg-1g
    // 8-12-hourly" with no stated daily maximum.
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 2000, frequency: "every 8-12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active hepatic disease", "Depression"],
  },
  {
    id: "drug_hydrochlorothiazide",
    generic_name: "Hydrochlorothiazide",
    brand_names: ["Esidrex"],
    class: "Thiazide Diuretic",
    // STG Ch.7, "51. Hypertension", 1st Line Treatment (Thiazide Diuretics) —
    // the only citation found for this drug in STG: "12.5-25mg daily".
    standard_dose_range: { minMgPerDose: 12.5, maxMgPerDose: 25, maxMgPerDay: 25, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_bendroflumethiazide",
    generic_name: "Bendroflumethiazide",
    brand_names: ["Aprinox"],
    class: "Thiazide Diuretic",
    // STG Ch.7, "51. Hypertension", 1st Line Treatment: "2.5mg daily".
    // Paediatric, weight-based (Hypertension in children): "12-18y 2.5mg
    // daily / 2-12y and 1mo-2y 50-100 micrograms/kg daily".
    standard_dose_range: { minMgPerDose: 2.5, maxMgPerDose: 5, maxMgPerDay: 5, frequency: "once daily", weightBased: true, pediatric: { mgPerKgPerDose: 0.075, maxMgPerDose: 2.5 } },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_spironolactone",
    generic_name: "Spironolactone",
    brand_names: ["Aldactone"],
    class: "Potassium-sparing Diuretic",
    // STG Ch.2 Ascites (the most complete citation, with pediatric dosing):
    // adult "50-200mg daily"; paediatric "0.3-3mg/kg daily". Cardiac/
    // hypertension indications use a lower range instead — Heart Failure
    // "25-50mg daily" (Ch.7), Hypertension 2nd line "25-50mg daily" — reported
    // here, not blended in.
    standard_dose_range: { minMgPerDose: 50, maxMgPerDose: 200, maxMgPerDay: 200, frequency: "once daily", weightBased: true, pediatric: { mgPerKgPerDose: 1.5, maxMgPerDose: 200 } },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Hyperkalaemia", "Severe renal impairment", "Addison's disease"],
  },
  {
    id: "drug_digoxin",
    generic_name: "Digoxin",
    brand_names: ["Lanoxin"],
    class: "Cardiac Glycoside",
    // STG Ch.7, "55. Arrhythmias", 2nd Line Treatment: adult "125-250
    // micrograms daily" (paediatric: "refer to a paediatrician"). Heart
    // Failure chapter gives a loading/maintenance schedule instead: elderly
    // "125mcg 12-hourly x24-48h then taper to 125mcg daily"; adult "250mcg
    // 12-hourly x24-48h, then 250mcg daily, then 125mcg daily".
    standard_dose_range: { minMgPerDose: 0.125, maxMgPerDose: 0.25, maxMgPerDay: 0.25, frequency: "once daily", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
    contraindications: ["Second/third-degree heart block", "Ventricular arrhythmias"],
  },
  {
    id: "drug_atorvastatin",
    generic_name: "Atorvastatin",
    brand_names: ["Lipitor"],
    class: "Statin",
    // STG Ch.12 Dyslipidaemia, Section B "Moderate CVD risk" (primary
    // prevention, the most general/common use): "10-20mg daily". Higher-risk
    // secondary prevention (same chapter) and the Stroke/ACS chapters use a
    // much higher "40-80mg daily" (Stroke) or "20-40mg daily" (ACS) instead —
    // reported here, not blended in. Explicitly "not recommended" in children
    // (Stroke chapter).
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 20, maxMgPerDay: 20, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active liver disease", "Pregnancy and breastfeeding"],
  },
  {
    id: "drug_simvastatin",
    generic_name: "Simvastatin",
    brand_names: ["Zocor"],
    class: "Statin",
    // STG Ch.12 Dyslipidaemia, Section A "Low CVD risk - primary prevention",
    // 1st Line: "10-20mg at night". Moderate-risk (same chapter) uses
    // "20-40mg at night"; the ACS chapter uses a much higher "40-80mg daily"
    // — reported here, not blended in.
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 20, maxMgPerDay: 20, frequency: "once at night", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active liver disease", "Pregnancy and breastfeeding", "Concurrent strong CYP3A4 inhibitors"],
  },

  // --- GI / antiemetics / antihistamines ---
  {
    id: "drug_metoclopramide",
    generic_name: "Metoclopramide",
    brand_names: ["Maxolon"],
    class: "Antiemetic (Prokinetic)",
    // STG's dominant, consistently-repeated adult citation across many
    // chapters (GORD, Vomiting, Heart Failure, Analgesia in Labour, Abortion):
    // "10mg 8-hourly" (some chapters state "5-10mg 8-hourly"). Paediatric
    // weight-based dosing found specifically for Retinoblastoma (Ch.6):
    // "100-400 micrograms/kg 8-hourly"; a separate weight-cutoff note exists
    // for Hyperemesis Gravidarum (<60kg: 5mg 8-hourly, max 500mcg/kg/day).
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 10, maxMgPerDay: 30, frequency: "every 8h", weightBased: true, pediatric: { mgPerKgPerDose: 0.25, maxMgPerDose: 10 } },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
    contraindications: ["GI obstruction or perforation", "Parkinson's disease"],
  },
  {
    id: "drug_hyoscine_butylbromide",
    generic_name: "Hyoscine Butylbromide",
    brand_names: ["Buscopan"],
    class: "Antispasmodic",
    // The only STG dosing citation found for this drug (searched as "Hyoscine
    // Butylbromide" / "Hyoscine-N-Butyl Bromide", its EML listing) is Ch.14
    // Urinary Tract Calculi: IV "20mg 8-hourly". No paediatric dose was found
    // anywhere in STG. General OTC use for cramps/spasm isn't separately
    // dosed in the source document.
    standard_dose_range: { minMgPerDose: 20, maxMgPerDose: 20, maxMgPerDay: 60, frequency: "every 8h", weightBased: false },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_loratadine",
    // NOT FOUND in either Ghana STG or EML (7th Ed. 2017) — searched
    // "Loratadine" and brand name "Claritin" against the full text of both
    // documents with no matches (the EML's Anti-Allergic Drugs section lists
    // only Adrenaline, Cetirizine, Chlorpheniramine, Dexamethasone,
    // Hydrocortisone, Prednisolone, and Promethazine). Cetirizine and
    // Chlorpheniramine are the STG-recognised antihistamines instead. Kept in
    // the search list with its original illustrative dosing, flagged as
    // not-on-EML in drugs.ts's NOT_ON_EML map with Cetirizine as the
    // suggested alternative, rather than defaulting to "listed."
    generic_name: "Loratadine",
    brand_names: ["Clarityne"],
    class: "Antihistamine",
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 10, maxMgPerDay: 10, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_cetirizine",
    generic_name: "Cetirizine",
    brand_names: ["Zyrtec"],
    class: "Antihistamine",
    // STG's consistent adult citation across several chapters (Pruritus,
    // Urticaria, Insect Bites): "10mg daily for 7 days". Paediatric, the most
    // complete age-band found (Insect Bites chapter): "7-18y 10mg daily / 2-6y
    // 5mg daily / <2y 2.5mg daily" (all for 7 days) — a flat age-banded dose,
    // not a per-kg figure, so no `pediatric` field is set here.
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 10, maxMgPerDay: 10, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_dexamethasone",
    generic_name: "Dexamethasone",
    brand_names: ["Decadron"],
    class: "Corticosteroid",
    // STG Ch.18 Meningitis: adult IV "4-10mg 6-hourly for 5-7 days".
    // Paediatric, weight-based (Ch.20 Stridor): "0.6mg/kg stat." Other
    // indications use very different regimens not blended in here — Preterm
    // Labour/foetal lung maturation "6mg 12-hourly for 4 doses";
    // chemotherapy-induced vomiting "8-12mg loading, then 8mg every 24h".
    standard_dose_range: { minMgPerDose: 4, maxMgPerDose: 10, maxMgPerDay: 40, frequency: "every 6h", weightBased: true, pediatric: { mgPerKgPerDose: 0.6, maxMgPerDose: 10 } },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },

  // --- Chronic / supplements ---
  {
    id: "drug_folic_acid",
    generic_name: "Folic Acid",
    brand_names: ["Folvite"],
    class: "Vitamin Supplement",
    // STG's dominant adult citation (Anaemia, Antenatal Care, Anaemia in
    // Pregnancy): "5mg daily". (Alcoholic Delirium Tremens chapter uses a
    // much lower "1mg daily" instead.) Paediatric (Folate Deficiency Anaemia,
    // Ch.4): "2.5-5mg daily" — a flat dose, not per-kg, so no `pediatric`
    // field is set here.
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 5, maxMgPerDay: 5, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_ferrous_sulfate",
    generic_name: "Ferrous Sulfate",
    brand_names: ["Ferrograd"],
    class: "Iron Supplement",
    // STG Ch.4 Iron Deficiency Anaemia, 1st Line: "200mg (65mg elemental iron)
    // 8-hourly for 3-6 months" — the same figure repeats in the Antenatal
    // Care chapter. Paediatric, fully age-banded in the same section: ">10y
    // 200mg 12-hourly / 8-10y 200mg daily / 5-7y 80-120mg 8-12-hourly / 1-4y
    // 45-90mg 8-12-hourly / <1y 30-60mg 8-12-hourly" (a flat age-banded dose,
    // not per-kg, so no `pediatric` field is set here). NOTE — the Anaemia in
    // Pregnancy and Chronic Kidney Disease chapters instead cite a higher
    // "325mg 8-hourly" for this drug, not blended into the figures below.
    standard_dose_range: { minMgPerDose: 200, maxMgPerDose: 200, maxMgPerDay: 600, frequency: "once to thrice daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_levothyroxine",
    generic_name: "Levothyroxine",
    brand_names: ["Eltroxin"],
    class: "Thyroid Hormone",
    // STG Ch.12 Hypothyroidism: adult "25-200 micrograms daily" (start low,
    // 25-50mcg, especially in the elderly/children/heart disease, titrating
    // every 6-8 weeks per TSH). Paediatric, age-banded: ">12y 25mcg daily
    // (max 200mcg) / 2-12y 25mcg daily (max 100mcg) / <2y 25-75mcg daily" — a
    // flat age-banded dose, not per-kg, so no `pediatric` field is set here.
    standard_dose_range: { minMgPerDose: 0.025, maxMgPerDose: 0.2, maxMgPerDay: 0.2, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_carbamazepine",
    generic_name: "Carbamazepine",
    brand_names: ["Tegretol"],
    class: "Anticonvulsant",
    // STG Ch.9 Epilepsy (the most common/general indication, with clean
    // pediatric weight-based dosing): adult "100-200mg initially, then
    // increase gradually to 0.8-1.2g 8-12-hourly"; paediatric "1mo-12y
    // 2.5-5mg/kg at night or 12-hourly, increasing as necessary". Bipolar
    // Disorder (Ch.10) uses a different "200-800mg 12-hourly" range (<18y not
    // recommended); Post-Herpetic Neuralgia/Trigeminal Neuralgia use a lower
    // "50-150mg 12-hourly, max 600mg 12-hourly" — neither blended in here.
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 1200, maxMgPerDay: 2400, frequency: "every 8-12h", weightBased: true, pediatric: { mgPerKgPerDose: 3.75, maxMgPerDose: 200 } },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["AV conduction abnormalities", "History of bone marrow depression"],
  },
  {
    id: "drug_amitriptyline",
    generic_name: "Amitriptyline",
    brand_names: ["Amitrip"],
    class: "Tricyclic Antidepressant",
    // STG Ch.10 Depression, 1st Line (the most complete citation, with
    // pediatric dosing): adult "25-50mg once daily (early evening), then
    // increase by 25mg every 3-5 days up to a max. of 150mg"; paediatric
    // ">16y 5-15mg 12-hourly / <16y not recommended" — a flat dose, not
    // per-kg, so no `pediatric` field is set here. (Fibromyalgia chapter, 2nd
    // line, uses a much lower starting dose instead: "10mg nocte, gradually
    // increased to 75mg daily".)
    standard_dose_range: { minMgPerDose: 25, maxMgPerDose: 50, maxMgPerDay: 150, frequency: "once at night", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Recent myocardial infarction", "Arrhythmias", "Concurrent MAO inhibitors"],
  },
];
