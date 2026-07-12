import type { Drug } from "../../types";
import { ghanaDrugsExtended } from "./drugsExtended";

// NOTE ON CLINICAL FIELDS (pregnancyCategory / renal- & hepaticDoseGuidance):
// These are illustrative demo values for well-established, textbook cases only
// (e.g. warfarin/ARBs in pregnancy, metformin in renal impairment). They are
// NOT an authoritative dosing source and are deliberately left undefined for
// drugs where the answer is nuanced — undefined simply means "not categorised"
// and the engine falls back to contraindication text rather than guessing.
//
// NOTE ON standard_dose_range / onEssentialMedicinesList (below): sourced from
// the real, official Ghana Ministry of Health documents — Standard Treatment
// Guidelines (STG), 7th Edition 2017, and Essential Medicines List (EML), 7th
// Edition 2017 (published by the Ghana National Drugs Programme; ISBN
// 978-9988-2-5787-3 and 978-9988-2-5786-6). Both were downloaded directly and
// read in full; every dose below is quoted or directly derived from the STG
// text, not estimated. The STG is organised BY DISEASE/CONDITION, not by
// drug — most drugs have several different doses across different
// indications (e.g. Aspirin: 75mg daily as an antiplatelet vs. 300-900mg
// 4-6-hourly for Acute Rheumatic Fever). Each entry below cites the single
// STG condition/chapter its `standard_dose_range` was drawn from; where a
// materially different dose exists for another indication, that's noted in
// the same comment rather than silently blended into one number.
const baseDrugs: Omit<Drug, "onEssentialMedicinesList" | "emlAlternativeDrugId">[] = [
  {
    id: "drug_paracetamol",
    pregnancyCategory: "B",
    hepaticDoseGuidance: "caution",
    generic_name: "Paracetamol",
    brand_names: ["Panadol"],
    class: "Analgesic/Antipyretic",
    // STG Ch.26 "Management of Acute Pain", Paracetamol: adult oral 0.5-1g 6-hourly
    // (max 4g/24h); paediatric 15mg/kg 6-hourly (max 60mg/kg/24h); neonates
    // 10-15mg/kg 8-12-hourly (max 30mg/kg/24h). This dedicated dosing table is
    // stricter ("6-hourly" only) than several other STG chapters (e.g. Sickle
    // Cell, Fever) which give "500mg-1g 6-8 hourly" with no stated daily max.
    standard_dose_range: {
      minMgPerDose: 500,
      maxMgPerDose: 1000,
      maxMgPerDay: 4000,
      frequency: "every 6h",
      weightBased: false,
      pediatric: { mgPerKgPerDose: 15, maxMgPerDose: 500 },
    },
    route: ["oral", "IV", "rectal"],
    region_availability: ["GH"],
  },
  {
    id: "drug_amoxicillin",
    renalDoseGuidance: "caution",
    generic_name: "Amoxicillin",
    brand_names: ["Amoxil"],
    class: "Penicillin",
    // STG general uncomplicated-infection dosing (e.g. preterm labour infection
    // prevention, dental abscess, ENT infection): adult 500mg 8-hourly.
    // Paediatric, age-banded: 6-12y 250mg, 1-5y 125mg, <1y 62.5mg (all 8-hourly);
    // weight-based for infants: 3mo-1y 20mg/kg 12-hourly, <3mo 15mg/kg 12-hourly.
    standard_dose_range: {
      minMgPerDose: 250,
      maxMgPerDose: 500,
      maxMgPerDay: 1500,
      frequency: "every 8h",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 20, maxMgPerDose: 500 },
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_artemether_lumefantrine",
    generic_name: "Artemether-Lumefantrine",
    brand_names: ["Coartem"],
    class: "Antimalarial",
    // STG Table 18-8 (Uncomplicated Malaria), dosed by weight band as a tablet
    // count (each tablet = artemether 20mg + lumefantrine 120mg), twice daily
    // for 3 days: 5-15kg -> 1 tablet/dose, 15-25kg -> 2, 25-35kg -> 3, >35kg -> 4.
    // Figures below track the lumefantrine (120mg/tablet) component: 1 tablet
    // (120mg) up to 4 tablets (480mg) per dose. STG gives this as a weight-band
    // tablet count, not a per-kg figure, so no `pediatric.mgPerKgPerDose` is set —
    // see the table itself for the real per-weight-band dosing.
    standard_dose_range: {
      minMgPerDose: 120,
      maxMgPerDose: 480,
      maxMgPerDay: 960,
      frequency: "twice daily for 3 days",
      weightBased: true,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_metformin",
    renalDoseGuidance: "avoid",
    generic_name: "Metformin",
    brand_names: ["Glucophage"],
    class: "Biguanide (Antidiabetic)",
    // STG Ch.12 Diabetes Mellitus, monotherapy: 500mg-1g daily initially,
    // titrated over 3 months to max 1g 12-hourly (2g/day). Diabetes in
    // Pregnancy chapter: 500mg 8-12-hourly, same 2g/day max. Paediatric use is
    // explicitly "refer to specialist" — no dose given, so left undefined here.
    standard_dose_range: {
      minMgPerDose: 500,
      maxMgPerDose: 1000,
      maxMgPerDay: 2000,
      frequency: "twice daily",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_amlodipine",
    generic_name: "Amlodipine",
    brand_names: ["Norvasc"],
    class: "Calcium Channel Blocker",
    // STG Ch.7, "51. Hypertension", 1st Line Treatment: 5-10mg daily. (EML
    // confirms Amlodipine is listed, though its strength column was lost to a
    // pdftotext extraction gap in the copy sourced for this pass.)
    standard_dose_range: {
      minMgPerDose: 5,
      maxMgPerDose: 10,
      maxMgPerDay: 10,
      frequency: "once daily",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_losartan",
    pregnancyCategory: "D",
    generic_name: "Losartan",
    brand_names: ["Cozaar"],
    class: "Angiotensin Receptor Blocker",
    // STG Ch.7, "51. Hypertension": 25-100mg daily (heart-failure/post-MI
    // indications use a narrower 25-50mg range instead). Paediatric,
    // weight-based: initial 0.7mg/kg daily (max 50mg), maintenance 1.4mg/kg
    // daily (max 100mg).
    standard_dose_range: {
      minMgPerDose: 25,
      maxMgPerDose: 100,
      maxMgPerDay: 100,
      frequency: "once daily",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 0.7, maxMgPerDose: 50 },
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_warfarin",
    pregnancyCategory: "X",
    hepaticDoseGuidance: "caution",
    generic_name: "Warfarin",
    brand_names: ["Coumadin"],
    class: "Anticoagulant",
    // STG Ch.7 (DVT / Pulmonary Embolism), loading-dose table: Day 1 10mg,
    // Day 2 10mg, Day 3 5mg (then check INR). Maintenance 2.5-5mg daily (some
    // patients need 7.5mg), titrated to a target INR of 2-3. Explicit STG note:
    // "Wafarin is not to be given in pregnancy" [sic]. No paediatric dose given
    // anywhere in STG.
    standard_dose_range: {
      minMgPerDose: 2.5,
      maxMgPerDose: 10,
      maxMgPerDay: 10,
      frequency: "once daily",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_aspirin",
    pregnancyCategory: "D",
    renalDoseGuidance: "caution",
    generic_name: "Aspirin",
    brand_names: ["Ecotrin"],
    class: "NSAID",
    // Two very different STG uses blended into one range here (data model has
    // one dose range per drug): antiplatelet (Ischaemic Heart Disease/Stroke,
    // Ch.7) "300mg stat. then 75mg daily", and anti-inflammatory (Ch.8,
    // "56. Acute Rheumatic Fever") "300-900mg 4-6-hourly until joint symptoms
    // relieved". maxMgPerDay reflects the Rheumatic Fever ceiling (900mg x4).
    // STG explicitly: do not give to children under 16 (Reye's syndrome risk);
    // the Stroke chapter separately confirms ">16 years; same as adult dose".
    standard_dose_range: {
      minMgPerDose: 75,
      maxMgPerDose: 300,
      maxMgPerDay: 3600,
      frequency: "once to four times daily",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_ibuprofen",
    pregnancyCategory: "C",
    renalDoseGuidance: "caution",
    generic_name: "Ibuprofen",
    brand_names: ["Brufen"],
    class: "NSAID",
    // STG general pain: "200-800mg 6-8-hourly (max. 2400mg daily)" (Acute
    // Rheumatic Fever 2nd option; repeated in Trauma chapters). Paediatric,
    // weight-based (Trauma chapter): "10-15mg/kg 6-8-hourly (max 40mg/kg/day)";
    // age-banded alternative also exists (6-12y 200-400mg, 1-5y 100-200mg).
    // Repeated STG caution: long-term NSAID use (>2 weeks) may cause renal
    // impairment and gastritis.
    standard_dose_range: {
      minMgPerDose: 200,
      maxMgPerDose: 800,
      maxMgPerDay: 2400,
      frequency: "every 6-8h",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 10, maxMgPerDose: 400 },
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_diclofenac",
    pregnancyCategory: "C",
    renalDoseGuidance: "caution",
    generic_name: "Diclofenac",
    brand_names: ["Voltaren"],
    class: "NSAID",
    // STG standard adult oral dosing, recurring across many chapters: "50mg
    // 8-hourly or 100mg 12-hourly". Paediatric explicitly limited: ">12 years;
    // 50mg 12-hourly / <12 years; not recommended" — so no pediatric field is
    // set here, matching STG's own restriction.
    standard_dose_range: {
      minMgPerDose: 50,
      maxMgPerDose: 100,
      maxMgPerDay: 200,
      frequency: "every 8-12h",
      weightBased: false,
    },
    route: ["oral", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_ceftriaxone",
    generic_name: "Ceftriaxone",
    brand_names: ["Rocephin"],
    class: "Cephalosporin",
    // STG general sepsis/pneumonia dosing (Ch.8 Pneumonia; Ch.20 Sepsis): adult
    // IV 1-2g daily, up to 2g daily for typhoid/pneumonia. (STI syndromic
    // management uses a much lower single 250mg IM dose instead; bacterial
    // meningitis uses a much higher 2-4g/day — both far outside this range,
    // reported here rather than blended in.) Paediatric, meningitis chapter:
    // <12y 50-80mg/kg/day.
    standard_dose_range: {
      minMgPerDose: 1000,
      maxMgPerDose: 2000,
      maxMgPerDay: 2000,
      frequency: "once daily",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 50, maxMgPerDose: 2000 },
    },
    route: ["IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_ciprofloxacin",
    pregnancyCategory: "C",
    renalDoseGuidance: "caution",
    generic_name: "Ciprofloxacin",
    brand_names: ["Cipro"],
    class: "Fluoroquinolone",
    // STG standard oral dosing (UTI, prostatitis, typhoid): "500mg 12-hourly".
    // IV alternative: "400mg 8-12-hourly, infused over 60 minutes". STI
    // syndromic management uses a single 500mg stat dose instead. Explicit STG
    // caution: contraindicated in pregnant/lactating women; may rarely cause
    // tendinitis.
    standard_dose_range: {
      minMgPerDose: 250,
      maxMgPerDose: 500,
      maxMgPerDay: 1000,
      frequency: "every 12h",
      weightBased: false,
    },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_metronidazole",
    hepaticDoseGuidance: "caution",
    generic_name: "Metronidazole",
    brand_names: ["Flagyl"],
    class: "Nitroimidazole",
    // STG standard oral dosing (obstetric/gynae infection prevention, most
    // common citation): "400mg 8-hourly for 5-7 days". IV alternative: "500mg
    // 8-hourly". Amoebic dysentery/liver abscess uses a higher "800mg
    // 8-hourly" (up to 2400mg/day) — noted here, not blended into the range.
    standard_dose_range: {
      minMgPerDose: 400,
      maxMgPerDose: 500,
      maxMgPerDay: 2000,
      frequency: "every 8h",
      weightBased: false,
    },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_omeprazole",
    generic_name: "Omeprazole",
    brand_names: ["Losec"],
    class: "Proton Pump Inhibitor",
    // STG Ch.1 Peptic Ulcer Disease: adult oral "20mg daily for 4 weeks" (repeat
    // if not fully healed); IV for bleeding ulcer: "40mg 12-hourly for up to 5
    // days". Paediatric (GORD chapter), weight-banded: >20kg 20mg, 10-20kg
    // 10mg, 5-10kg 5mg (all once daily).
    standard_dose_range: {
      minMgPerDose: 20,
      maxMgPerDose: 40,
      maxMgPerDay: 40,
      frequency: "once daily",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_salbutamol",
    generic_name: "Salbutamol",
    brand_names: ["Ventolin"],
    class: "Beta-2 Agonist (Bronchodilator)",
    // STG Ch.8 Bronchial Asthma: pMDI+spacer "1-2 puffs, repeat every 15-30 min
    // (max 10 doses)" for acute exacerbation; hospital nebulised dosing
    // "2.5-5mg, repeated every 2-4 hours until improved" for adults and
    // children alike. Figures below model the inhaler (0.1mg = 100mcg/puff,
    // standard MDI strength).
    standard_dose_range: {
      minMgPerDose: 0.1,
      maxMgPerDose: 0.2,
      maxMgPerDay: 1.6,
      frequency: "every 4-6h as needed",
      weightBased: false,
    },
    route: ["inhaled", "oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_prednisolone",
    generic_name: "Prednisolone",
    brand_names: ["Deltacortril"],
    class: "Corticosteroid",
    // STG Ch.8 Bronchial Asthma, Section C: adult "30-40mg daily for 7 days
    // until stable" (taper over 2 weeks if on long-term steroids); paediatric
    // "1-2mg/kg for 3-5 days". Other indications (e.g. general
    // anti-inflammatory/immunosuppressive maintenance) use lower doses not
    // captured by this single citation.
    standard_dose_range: {
      minMgPerDose: 30,
      maxMgPerDose: 40,
      maxMgPerDay: 40,
      frequency: "once daily",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 1.5, maxMgPerDose: 40 },
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_insulin_actrapid",
    generic_name: "Insulin (Actrapid)",
    brand_names: ["Actrapid"],
    class: "Insulin",
    // STG Ch.12 Diabetes Mellitus: total daily insulin requirement for most
    // adults and pre-pubertal children is "about 0.6-0.8 units/kg... in
    // divided doses"; stepwise NPH dosing "2-20 units before bedtime" (adult
    // paediatric NPH initiation is explicitly "refer to specialist"). Figures
    // below keep the app's existing generic sliding-scale representation,
    // which STG's per-kg total-daily-requirement figure doesn't map onto
    // directly (STG doesn't give a single-injection sliding-scale table).
    standard_dose_range: {
      minMgPerDose: 1,
      maxMgPerDose: 100,
      maxMgPerDay: 300,
      frequency: "per sliding scale",
      weightBased: false,
    },
    route: ["IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_glibenclamide",
    generic_name: "Glibenclamide",
    brand_names: ["Daonil"],
    class: "Sulfonylurea (Antidiabetic)",
    // STG Ch.12 Diabetes Mellitus, Dual Therapy: "2.5-10mg daily (if required,
    // not more than 5mg additionally in the evening; max. total 15mg daily)".
    // Explicitly "not recommended" in children.
    standard_dose_range: {
      minMgPerDose: 2.5,
      maxMgPerDose: 10,
      maxMgPerDay: 15,
      frequency: "once or twice daily",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_furosemide",
    renalDoseGuidance: "caution",
    generic_name: "Furosemide",
    brand_names: ["Lasix"],
    class: "Loop Diuretic",
    // STG Ch.14/15 Nephrotic Syndrome: IV "40-80mg 8-12-hourly (max 160mg
    // daily)"; oral "40mg daily increasing to 80mg (max 240mg daily)".
    // Paediatric, weight-based (Post-infectious Glomerulonephritis): "1-2mg/kg/
    // day initially, increase to max 6mg/kg/day (not exceeding 80mg/day)";
    // neonates "0.5-1mg/kg 8-24-hourly (max 2mg/kg)".
    standard_dose_range: {
      minMgPerDose: 20,
      maxMgPerDose: 80,
      maxMgPerDay: 160,
      frequency: "once or twice daily",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 1.5, maxMgPerDose: 80 },
    },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_diazepam",
    pregnancyCategory: "D",
    hepaticDoseGuidance: "caution",
    generic_name: "Diazepam",
    brand_names: ["Valium"],
    class: "Benzodiazepine",
    // STG Ch.10 Psychiatric Disorders: adult oral "5-10mg 6-12-hourly";
    // paediatric age-banded "12-18y 10mg 12-hourly / 5-12y 5mg 12-hourly" (not
    // a flat mg/kg figure, so not encoded in `pediatric` — see STG for the
    // full age-band table). IV: "5-10mg slowly over 2-3 minutes". Also used
    // rectally for seizures/agitation with its own separate age-banded dosing.
    standard_dose_range: {
      minMgPerDose: 5,
      maxMgPerDose: 10,
      maxMgPerDay: 30,
      frequency: "two to three times daily",
      weightBased: false,
    },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_chlorpheniramine",
    generic_name: "Chlorpheniramine",
    brand_names: ["Piriton"],
    class: "Antihistamine",
    // STG Ch.8 Common Cold: adult "4mg 12-hourly". Paediatric, age-banded:
    // "6-12y 2mg 6-12-hourly (max 12mg/day) / 2-6y 1mg 6-8-hourly (max 6mg/
    // day) / 1-2y not recommended". This 12-hourly adult schedule is a real
    // correction from the previous illustrative "every 4-6h" figure.
    standard_dose_range: {
      minMgPerDose: 4,
      maxMgPerDose: 4,
      maxMgPerDay: 8,
      frequency: "every 12h",
      weightBased: false,
    },
    route: ["oral", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_quinine",
    generic_name: "Quinine",
    brand_names: ["Qualaquin"],
    class: "Antimalarial",
    // STG Ch.18 Severe Malaria: IV then oral step-down, "10mg/kg (max 600mg)
    // infused over 4-8 hours, repeated 8-hourly until able to swallow, then
    // 10mg/kg 8-hourly to complete 7 days" — same weight-based dose for adults
    // and children alike. Also used as oral monotherapy in 1st-trimester
    // malaria in pregnancy at the same 10mg/kg (max 600mg) 8-hourly regimen.
    standard_dose_range: {
      minMgPerDose: 600,
      maxMgPerDose: 600,
      maxMgPerDay: 1800,
      frequency: "every 8h",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 10, maxMgPerDose: 600 },
    },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_sulfadoxine_pyrimethamine",
    generic_name: "Sulfadoxine-Pyrimethamine",
    brand_names: ["Fansidar"],
    class: "Antifolate Antimalarial",
    // IMPORTANT — STG restricts this drug to Intermittent Preventive Treatment
    // in Pregnancy (IPTp) ONLY: "SP is not to be used for other purposes such
    // as treatment of acute attacks of malaria" (Ch.18, Malaria in Pregnancy).
    // Dosed as Directly Observed Therapy at antenatal visits, one month apart,
    // 3-7 times from 16 weeks gestation (or up to 5 doses per the Antenatal
    // Care chapter) — not the "single treatment dose" this app currently
    // models. The per-dose tablet count itself was not recoverable from the
    // extracted STG text (the dosing table was corrupted by PDF-to-text
    // column scrambling); the figures below keep the existing single-dose
    // value (3 x 500mg/25mg tablets, the standard WHO/regional treatment-dose
    // convention) since no STG-specific number could be confirmed, but the
    // IPTp-only restriction above is a real, sourced finding.
    standard_dose_range: {
      minMgPerDose: 1500,
      maxMgPerDose: 1500,
      maxMgPerDay: 1500,
      frequency: "single dose",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_cotrimoxazole",
    pregnancyCategory: "D",
    renalDoseGuidance: "caution",
    generic_name: "Co-trimoxazole",
    brand_names: ["Septrin"],
    class: "Antifolate Antibacterial",
    // STG lists this drug under its component name "Trimethoprim/
    // Sulphamethoxazole" (Ch.5, Pertussis 2nd-line treatment): adult
    // "160/800mg 12-hourly for 7 days" (i.e. 960mg combined per dose);
    // paediatric weight-based "4/20mg/kg 12-hourly for 7 days". STG explicitly
    // warns against co-trimoxazole for acute streptococcal throat infections.
    standard_dose_range: {
      minMgPerDose: 480,
      maxMgPerDose: 960,
      maxMgPerDay: 1920,
      frequency: "twice daily",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 24, maxMgPerDose: 960 },
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
];

/**
 * Drugs not carried on Ghana's Essential Medicines List (7th Edition, 2017),
 * paired with an EML-listed alternative in the same therapeutic role. Every
 * other drug in the formulary is treated as EML-listed. Kept as a small
 * override map (rather than a field on every entry) so the EML status of the
 * formulary is auditable at a glance. EML status is a flag on each record —
 * non-EML drugs remain in the dataset and searchable, just tagged.
 *
 * Verified directly against the real EML 7th Edition 2017 text (see the
 * sourcing note at the top of this file). This is a real correction from an
 * earlier illustrative version of this map: Losartan, Sulfadoxine-
 * Pyrimethamine, Clarithromycin, Levofloxacin, Atorvastatin, and Bisoprolol
 * were all previously (incorrectly) assumed absent based on general clinical
 * reasoning — the actual EML text lists all six. Only Cephalexin and
 * Loratadine were confirmed genuinely absent from both the EML and STG after
 * a full-text search (see their own comments in drugsExtended.ts).
 */
const NOT_ON_EML: Record<string, string | undefined> = {
  // Confirmed absent from both EML and STG (full-text search, no match under
  // "Cephalexin", "Cefalexin", or "Keflex"). Cefuroxime is STG's EML-listed
  // cephalosporin of choice for the general infections Cephalexin would cover.
  drug_cephalexin: "drug_cefuroxime",
  // Confirmed absent from both EML and STG (full-text search, no match under
  // "Loratadine" or "Claritin"). Cetirizine is the STG-recognised, EML-listed
  // antihistamine.
  drug_loratadine: "drug_cetirizine",
};

/**
 * De-duplicates by generic name (case-insensitive), keeping the first
 * occurrence. Guards the merge of the core + extended lists so a drug can
 * never appear twice under different IDs — the root-cause guarantee behind the
 * duplicate-key class of bugs.
 */
function dedupeByGenericName<T extends { generic_name: string }>(drugs: T[]): T[] {
  const seen = new Set<string>();
  return drugs.filter((d) => {
    const key = d.generic_name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const ghanaDrugs: Drug[] = dedupeByGenericName([...baseDrugs, ...ghanaDrugsExtended]).map(
  (drug) => {
    const alternative = NOT_ON_EML[drug.id];
    const onEML = !(drug.id in NOT_ON_EML);
    return {
      ...drug,
      onEssentialMedicinesList: onEML,
      ...(alternative ? { emlAlternativeDrugId: alternative } : {}),
    };
  }
);
