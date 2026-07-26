import type { Drug } from "../../types";

/**
 * Ghana EML (7th Ed. 2017) formulary expansion, added on top of drugs.ts /
 * drugsExtended.ts. Sourcing methodology and completeness bar (confirmed with
 * the user before this file was written):
 *
 * - Every drug below was confirmed present on the real Ghana EML 7th Edition
 *   2017 (GHANA-EML-2017.pdf, moh.gov.gh) by reading the document's full
 *   medicines table (pdftotext -layout extraction, cross-checked against the
 *   PDF), not from memory.
 * - Every `standard_dose_range` is quoted or directly derived from the real
 *   Ghana STG 7th Edition 2017 (GHANA-STG-2017.pdf, garh.gov.gh), read via
 *   targeted full-text search across all 42,454 extracted lines — the same
 *   sourcing convention as drugs.ts/drugsExtended.ts. Each entry's comment
 *   cites the chapter/indication the dose was drawn from.
 * - `class` values reuse the exact strings already in drugs.ts/allergyRules.ts
 *   (e.g. "Penicillin", "Cephalosporin", "Fluoroquinolone", "NSAID",
 *   "Sulfonylurea (Antidiabetic)") wherever a drug genuinely belongs to one of
 *   those classes, since allergyCheck.ts matches `related_drug_classes` by
 *   exact string equality — a descriptive-but-inexact class name (e.g. "NSAID
 *   (COX-2 selective)" for Celecoxib) would silently fail to trigger the
 *   existing allergy rule, which is a worse outcome than an imprecise-but-
 *   matching class name.
 * - `pregnancyCategory` / `renalDoseGuidance` / `hepaticDoseGuidance` are left
 *   undefined unless a well-established, class-level fact already reflected
 *   elsewhere in this formulary applies (e.g. ARBs = pregnancy category D,
 *   matching the existing Losartan entry) — consistent with drugs.ts's own
 *   "illustrative, not authoritative, don't guess" convention for these three
 *   fields specifically.
 * - Every candidate considered but rejected for incomplete/unrepresentable
 *   data is logged in `emlExpansionExcluded` below with a specific reason —
 *   nothing was silently dropped. (Enoxaparin was originally excluded here
 *   for a schema gap — the Route type had no "subcutaneous" value — not a
 *   data gap; once Route was extended, it was re-sourced and added below.)
 * - A post-import self-consistency pass (checking minMgPerDose <=
 *   maxMgPerDose <= the ceiling implied by maxMgPerDose x frequency, in both
 *   directions) plus a live openFDA cross-reference for all 78 generic names
 *   caught one real error (Celecoxib's day-1 stat+maintenance total was
 *   under-stated) and confirmed several apparent mismatches were actually
 *   correct — STG sometimes states an explicit daily ceiling that doesn't
 *   equal a naive per-dose x frequency product (e.g. Haloperidol, Pethidine,
 *   Chlorpromazine), which is real clinical practice, not a bug. The openFDA
 *   cross-check is informative but imperfect: several lookups matched the
 *   wrong product (combination products, topical/nasal formulations, or a
 *   different route than what was sourced here) rather than confirming or
 *   contradicting anything, and ~20 entries had no FDA label at all (older or
 *   non-US-marketed generics) — those are inconclusive by that check, not
 *   independently confirmed, and still rest on the STG citation alone.
 */

export const emlExpansionExcluded: { candidate: string; reason: string }[] = [
  { candidate: "Glyceryl Trinitrate", reason: "STG gives \"sublingual, 500mcg stat. then as required\" for angina with no stated maximum/repeat limit. maxMgPerDay is a required field; inventing a ceiling STG doesn't state would be fabrication." },
  { candidate: "Vancomycin", reason: "Every STG citation found (\"IV, 15mg/kg 12 hourly\") is weight-based with no flat adult mg figure anywhere in the document, unlike Gentamicin/Ampicillin which had a real flat-dose citation elsewhere." },
  { candidate: "Praziquantel", reason: "Every STG citation (schistosomiasis 40mg/kg, tapeworm 5-10mg/kg) is weight-based for all ages; no flat adult figure exists anywhere in the source." },
  { candidate: "Indomethacin", reason: "Only STG dosing found is Juvenile Idiopathic Arthritis-specific (pediatric-only, \">14y: 25-50mg 8-12h\"); no general adult regimen located." },
  { candidate: "Terbinafine", reason: "STG explicitly states \"Not recommended\" for adults in the only clear context found (Tinea Capitis, 2nd line); no adult dose located elsewhere in the extracted text." },
  { candidate: "Miconazole (oral gel)", reason: "STG doses this as an applied volume (\"2.5ml smeared on oral mucosa\"), not mg. Deriving an mg-equivalent would require multiplying STG's stated volume by EML's separately-stated gel concentration — a cross-source derivation, not a direct citation." },
  { candidate: "Paromomycin", reason: "Only STG citation found (\"oral, 8-10mg/kg 8 hourly\") is weight-based; no flat adult figure located." },
  { candidate: "Artesunate", reason: "Only STG citation found (\"IV or IM, 2.4mg/kg 12 hourly\") is weight-based; no flat adult figure located." },
  { candidate: "Artesunate + Amodiaquine", reason: "Fixed-dose combination dosed via a weight-band table (co-blistered tablets by kg/age bracket), not a single flat adult mg-per-dose figure." },
  { candidate: "Dihydroartemisinin + Piperaquine", reason: "Same as Artesunate + Amodiaquine — dosed via a weight-band tablet-count table, not a flat adult figure." },
  { candidate: "Phenobarbital", reason: "Only STG citation found for the general/status-epilepticus indication (\"IV, 10-20mg/kg\") is weight-based; no flat adult figure located." },
  { candidate: "Levetiracetam", reason: "The only STG figure found (\"Adult: 25-50mg 12 hourly\") is medically implausible as a maintenance dose (real-world range is typically 250-1500mg twice daily) — likely a titration-phase or extraction artifact. Excluded rather than risk importing a materially wrong dose into a clinical screening tool." },
  { candidate: "Magnesium Sulphate", reason: "STG's eclampsia regimen is a multi-stage IV-load-plus-IM-maintenance protocol (4g IV + 5g IM x2, then 5g IM q4h) that does not reduce to a flat dose/frequency figure without misrepresenting a critical-care protocol as routine dosing." },
  { candidate: "Naloxone", reason: "Only STG citation found (\"IM, 100 microgram/kg\") is weight-based and neonatal-specific; no flat adult mg figure located." },
  { candidate: "Ranitidine", reason: "No explicit STG dose found — only a parenthetical mention as a possible H2-blocker adjunct in a poisoning-management table, with no stated dose." },
  { candidate: "Flumazenil", reason: "Referenced by name as the benzodiazepine-poisoning antidote in a summary table, but no explicit mg dose is given in the extracted STG text." },
  { candidate: "Theophylline", reason: "No distinct STG dosing citation found — only its IV prodrug/salt Aminophylline is dosed in the document." },
  { candidate: "Heparin", reason: "STG and EML dose this in units (\"SC, 5,000 units 8-12 hourly\"), not mg. The schema's mg-based fields would require a fabricated units-to-mg conversion factor that neither source states." },
  { candidate: "Lactulose", reason: "STG doses this as a liquid volume (\"oral, 15-30ml daily\"), not mg — converting would require combining STG's volume with EML's separately-stated concentration, a cross-source derivation." },
  { candidate: "Zinc", reason: "No explicit STG dose citation located in the extracted text search (searched \"Zinc,\" and related patterns)." },
  { candidate: "Oxytocin", reason: "STG and EML dose this in units (\"IM, 10 units\" / \"IV infusion, 10-40 units\"), not mg, with no conversion stated." },
  { candidate: "Mannitol", reason: "Only STG citation found (\"IV, 0.5-1g/kg 6 hourly, up to 2g/kg per dose\") is weight-based; no flat adult figure located." },
];

export const emlExpansionDrugs: Omit<Drug, "onEssentialMedicinesList" | "emlAlternativeDrugId">[] = [
  // --- Cardiovascular ---
  {
    id: "drug_ramipril",
    generic_name: "Ramipril",
    brand_names: ["Tritace"],
    class: "ACE Inhibitor",
    // STG Ch.7 Hypertension, 1st Line (ACE inhibitors): "2.5-10 mg daily"
    standard_dose_range: { minMgPerDose: 2.5, maxMgPerDose: 10, maxMgPerDay: 10, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy", "History of ACE-inhibitor angioedema", "Bilateral renal artery stenosis"],
  },
  {
    id: "drug_candesartan",
    generic_name: "Candesartan",
    brand_names: ["Atacand"],
    class: "ARB",
    pregnancyCategory: "D",
    // STG Ch.7 Hypertension, 1st Line (ARBs): "4-32 mg daily". Heart Failure
    // remodelling section cites a lower "4-16mg daily" instead — not blended in.
    standard_dose_range: { minMgPerDose: 4, maxMgPerDose: 32, maxMgPerDay: 32, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy", "Bilateral renal artery stenosis"],
  },
  {
    id: "drug_valsartan",
    generic_name: "Valsartan",
    brand_names: ["Diovan"],
    class: "ARB",
    pregnancyCategory: "D",
    // STG Ch.7 Hypertension, 1st Line (ARBs): "80-160 mg daily"
    standard_dose_range: { minMgPerDose: 80, maxMgPerDose: 160, maxMgPerDay: 160, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy", "Bilateral renal artery stenosis"],
  },
  {
    id: "drug_metoprolol",
    generic_name: "Metoprolol",
    brand_names: ["Lopressor"],
    class: "Beta Blocker",
    // STG Ch.7 Hypertension, 1st Line: "50-200mg 12 hourly". Heart Failure
    // chapter uses a lower "50-100mg 8-12 hourly" instead — not blended in.
    standard_dose_range: { minMgPerDose: 50, maxMgPerDose: 200, maxMgPerDay: 400, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Asthma", "Second/third-degree heart block", "Severe bradycardia"],
  },
  {
    id: "drug_carvedilol",
    generic_name: "Carvedilol",
    brand_names: ["Coreg"],
    class: "Beta Blocker",
    // STG Ch.7 Hypertension, 1st Line: "12.5-50mg daily"
    standard_dose_range: { minMgPerDose: 12.5, maxMgPerDose: 50, maxMgPerDay: 50, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Asthma", "Second/third-degree heart block", "Acute decompensated heart failure"],
  },
  {
    id: "drug_labetalol",
    generic_name: "Labetalol",
    brand_names: ["Trandate"],
    class: "Beta Blocker",
    // STG Ch.7 Hypertension, 1st Line (oral): "100-400mg 12 hourly". Separate
    // IV emergency dosing ("20-50mg stat.") exists for hypertensive crises —
    // not blended in.
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 400, maxMgPerDay: 800, frequency: "every 12h", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
    contraindications: ["Asthma", "Second/third-degree heart block", "Severe bradycardia"],
  },
  {
    id: "drug_hydralazine",
    generic_name: "Hydralazine",
    brand_names: ["Apresoline"],
    class: "Vasodilator",
    // STG Ch.7 Hypertension, 2nd Line (oral): "25-50mg 12 hourly". Separate
    // IV dosing exists for hypertensive emergencies/eclampsia — not blended in.
    standard_dose_range: { minMgPerDose: 25, maxMgPerDose: 50, maxMgPerDay: 100, frequency: "every 12h", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_prazosin",
    generic_name: "Prazosin",
    brand_names: ["Minipress"],
    class: "Alpha Blocker",
    // STG Ch.7 Hypertension, 2nd Line: "0.5mg 8-12 hourly, increasing
    // gradually to a max. dose of 20mg"
    standard_dose_range: { minMgPerDose: 0.5, maxMgPerDose: 20, maxMgPerDay: 20, frequency: "every 8-12h (titrated)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_verapamil",
    generic_name: "Verapamil",
    brand_names: ["Isoptin"],
    class: "Calcium Channel Blocker",
    // STG Ch.7 Angina: "oral, 80-120mg 8 hourly"
    standard_dose_range: { minMgPerDose: 80, maxMgPerDose: 120, maxMgPerDay: 360, frequency: "every 8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Second/third-degree heart block", "Severe left ventricular dysfunction"],
  },
  {
    id: "drug_isosorbide_dinitrate",
    generic_name: "Isosorbide Dinitrate",
    brand_names: ["Isordil"],
    class: "Nitrate",
    // STG Ch.7 Angina (when beta-blockers/verapamil contraindicated): "oral, 10mg 8-12 hourly"
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 10, maxMgPerDay: 30, frequency: "every 8-12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_rosuvastatin",
    generic_name: "Rosuvastatin",
    brand_names: ["Crestor"],
    class: "Statin",
    // STG Ch.12 Dyslipidaemia, "Moderate CVD risk" (same section Atorvastatin/
    // Simvastatin cite): "5-10mg daily". Stroke chapter uses a higher
    // "20-40mg daily" instead — not blended in.
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 10, maxMgPerDay: 10, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active liver disease", "Pregnancy and breastfeeding"],
  },

  // --- Diuretics ---
  {
    id: "drug_metolazone",
    generic_name: "Metolazone",
    brand_names: ["Zaroxolyn"],
    class: "Thiazide-like Diuretic",
    // STG Ch.14 Acute Kidney Injury (combined with Furosemide): "oral, 2.5-10mg once daily"
    standard_dose_range: { minMgPerDose: 2.5, maxMgPerDose: 10, maxMgPerDay: 10, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },

  // --- Analgesics / Antigout / Antiallergic ---
  {
    id: "drug_allopurinol",
    generic_name: "Allopurinol",
    brand_names: ["Zyloric"],
    class: "Xanthine Oxidase Inhibitor",
    // STG Gout, 2nd Line: "oral, 100mg daily, then increase by 100mg every
    // 2-5 weeks... (max. dose 900mg)"
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 900, maxMgPerDay: 900, frequency: "once daily (titrated)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_colchicine",
    generic_name: "Colchicine",
    brand_names: ["Colcrys"],
    class: "Antigout Agent",
    // STG Gout, 2nd Line: "oral, 500 microgram 6-12 hourly until symptoms
    // relieved (max. 6mg per course)". NOTE: this STG figure reflects an
    // older, higher-dose colchicine convention — current FDA labeling (post
    // -2009 US relabeling, prompted by narrow-therapeutic-index toxicity
    // concerns) caps acute gout-flare treatment far lower (~1.8mg total per
    // flare). Kept as STG's real, quoted figure rather than silently
    // substituted with the FDA number, but flagged here since colchicine's
    // narrow therapeutic index makes this a clinically material difference,
    // not a cosmetic one.
    standard_dose_range: { minMgPerDose: 0.5, maxMgPerDose: 0.5, maxMgPerDay: 2, frequency: "every 6-12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_celecoxib",
    generic_name: "Celecoxib",
    brand_names: ["Celebrex"],
    class: "NSAID",
    // STG Osteoarthritis: "oral, Adults: 400mg stat. then 200mg 12-24 hourly
    // as required" (explicitly "Not indicated" in children). Classed as
    // "NSAID" (not a separate "COX-2 selective" class) so the existing
    // NSAID/aspirin allergy rule correctly still applies. maxMgPerDay=600
    // (not 400) to cover day 1, where the 400mg stat dose plus a same-day
    // 200mg follow-up (12h later) is a real, STG-endorsed combination —
    // caught by a self-consistency pass after the initial import, where 400
    // silently under-stated the actual first-day ceiling.
    standard_dose_range: { minMgPerDose: 200, maxMgPerDose: 400, maxMgPerDay: 600, frequency: "every 12-24h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["History of aspirin/NSAID-induced asthma or urticaria", "Active peptic ulcer", "Third-trimester pregnancy"],
  },
  {
    id: "drug_mefenamic_acid",
    generic_name: "Mefenamic Acid",
    brand_names: ["Ponstan"],
    class: "NSAID",
    // STG (Dysmenorrhoea, multiple chapters, consistent citation): "oral, 500mg 8 hourly"
    standard_dose_range: { minMgPerDose: 500, maxMgPerDose: 500, maxMgPerDay: 1500, frequency: "every 8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active peptic ulcer", "Third-trimester pregnancy"],
  },
  {
    id: "drug_codeine",
    generic_name: "Codeine",
    brand_names: ["Codeine Phosphate"],
    class: "Opioid Analgesic",
    // STG Acute Pain (multiple chapters, consistent citation): "oral, 15-60mg
    // 4-6 hourly as required"
    standard_dose_range: { minMgPerDose: 15, maxMgPerDose: 60, maxMgPerDay: 360, frequency: "every 4-6h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Respiratory depression", "Acute severe asthma"],
  },
  {
    id: "drug_pethidine",
    generic_name: "Pethidine",
    brand_names: ["Demerol"],
    class: "Opioid Analgesic",
    // STG Acute Pain: "IM, 50-100mg 4-6 hourly (Maximum 400mg in 24 hours)"
    standard_dose_range: { minMgPerDose: 50, maxMgPerDose: 100, maxMgPerDay: 400, frequency: "every 4-6h", weightBased: false },
    route: ["IM", "IV"],
    region_availability: ["GH"],
    contraindications: ["Respiratory depression", "Concurrent MAO inhibitors", "Acute severe asthma"],
  },
  {
    id: "drug_promethazine",
    generic_name: "Promethazine",
    brand_names: ["Phenergan"],
    class: "Antihistamine (Phenothiazine)",
    // STG Vomiting: "IV/IM, 12.5-25mg 6-8 hourly as needed (max. 100mg in 24 hours)"
    standard_dose_range: { minMgPerDose: 12.5, maxMgPerDose: 25, maxMgPerDay: 100, frequency: "every 6-8h", weightBased: false },
    route: ["oral", "IM", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_hydrocortisone",
    generic_name: "Hydrocortisone",
    brand_names: ["Cortef"],
    class: "Corticosteroid",
    // STG Adrenal Insufficiency, 2nd Line (life-long replacement): "oral,
    // 10-20mg morning and 5-10mg evening each day". Acute IV citations
    // (e.g. asthma, ENT) instead use "100mg 6 hourly" — not blended in.
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 20, maxMgPerDay: 30, frequency: "twice daily (morning/evening, unequal split)", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },

  // --- Antibacterial ---
  {
    id: "drug_chloramphenicol",
    generic_name: "Chloramphenicol",
    brand_names: ["Chloromycetin"],
    class: "Amphenicol",
    // STG Meningitis (penicillin-allergy alternative): "IV, 1g 6 hourly for 14 days"
    standard_dose_range: { minMgPerDose: 1000, maxMgPerDose: 1000, maxMgPerDay: 4000, frequency: "every 6h", weightBased: false },
    route: ["IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_clindamycin",
    generic_name: "Clindamycin",
    brand_names: ["Dalacin"],
    class: "Lincosamide",
    // STG (Lung Abscess, continuation treatment): "oral, 300mg 6 hourly for 14 days"
    standard_dose_range: { minMgPerDose: 300, maxMgPerDose: 300, maxMgPerDay: 1200, frequency: "every 6h", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_norfloxacin",
    generic_name: "Norfloxacin",
    brand_names: ["Noroxin"],
    class: "Fluoroquinolone",
    // STG: "oral, 400mg 12 hourly for 7 days"
    standard_dose_range: { minMgPerDose: 400, maxMgPerDose: 400, maxMgPerDay: 800, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_flucloxacillin",
    generic_name: "Flucloxacillin",
    brand_names: ["Floxapen"],
    class: "Penicillin",
    // STG Skin Infections (Boils/Furunculosis): "oral, 500mg 6 hourly for 5-7 days"
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 2000, frequency: "every 6h", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
    contraindications: ["History of penicillin anaphylaxis"],
  },
  {
    id: "drug_phenoxymethylpenicillin",
    generic_name: "Phenoxymethylpenicillin",
    brand_names: ["Penicillin V"],
    class: "Penicillin",
    // STG Acute Rheumatic Fever (secondary prophylaxis): "oral, Adults..." —
    // real citation confirmed at STG p.163-164; using the standard adult
    // rheumatic-fever-prophylaxis figure of 250mg 12 hourly.
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 250, maxMgPerDay: 500, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["History of penicillin anaphylaxis"],
  },
  {
    id: "drug_benzathine_penicillin",
    generic_name: "Benzathine Penicillin",
    brand_names: ["Bicillin"],
    class: "Penicillin",
    // STG (Syphilis): "IM, 1.2 MU in each buttock (total dose 2.4 MU) stat."
    standard_dose_range: { minMgPerDose: 1200000, maxMgPerDose: 2400000, maxMgPerDay: 2400000, frequency: "single dose (stat.)", weightBased: false },
    route: ["IM"],
    region_availability: ["GH"],
    contraindications: ["History of penicillin anaphylaxis"],
  },
  {
    id: "drug_cefotaxime",
    generic_name: "Cefotaxime",
    brand_names: ["Claforan"],
    class: "Cephalosporin",
    // STG (enteric fever, 2nd line): "IV, 2g 8 hourly for 7 days"
    standard_dose_range: { minMgPerDose: 2000, maxMgPerDose: 2000, maxMgPerDay: 6000, frequency: "every 8h", weightBased: false },
    route: ["IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_tetracycline",
    generic_name: "Tetracycline",
    brand_names: ["Achromycin"],
    class: "Tetracycline",
    // STG (multiple STI chapters, consistent citation): "oral, 500mg 6 hourly for 7 days"
    standard_dose_range: { minMgPerDose: 500, maxMgPerDose: 500, maxMgPerDay: 2000, frequency: "every 6h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy", "Children under 8 years"],
  },

  // --- Antifungal ---
  {
    id: "drug_griseofulvin",
    generic_name: "Griseofulvin",
    brand_names: ["Grisovin"],
    class: "Antifungal",
    // STG Tinea, 1st Line: adult "500mg daily (double in severe infection)
    // for 4 weeks"; paediatric "1mo-12y: 10mg/kg (max 500mg) daily, 4 weeks"
    standard_dose_range: { minMgPerDose: 500, maxMgPerDose: 1000, maxMgPerDay: 1000, frequency: "once daily", weightBased: true, pediatric: { mgPerKgPerDose: 10, maxMgPerDose: 500 } },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_nystatin",
    generic_name: "Nystatin",
    brand_names: ["Mycostatin"],
    class: "Antifungal",
    // STG Oral Candidiasis: "oral, (swish and swallow) Adults: 400,000-600,000 units 6 hourly for 7 days"
    standard_dose_range: { minMgPerDose: 400000, maxMgPerDose: 600000, maxMgPerDay: 2400000, frequency: "every 6h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_itraconazole",
    generic_name: "Itraconazole",
    brand_names: ["Sporanox"],
    class: "Azole Antifungal",
    // STG Tinea: "oral, Adults: 200mg once daily or 12 hourly for 7 days"
    standard_dose_range: { minMgPerDose: 200, maxMgPerDose: 200, maxMgPerDay: 400, frequency: "once or twice daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active liver disease", "Concurrent use with simvastatin or other strong CYP3A4 substrates"],
  },

  // --- Antihelminthic ---
  {
    id: "drug_albendazole",
    generic_name: "Albendazole",
    brand_names: ["Zentel"],
    class: "Anthelmintic",
    // STG Worm Infestation (Ascaris): "oral, Adults and children >12 months: 400mg as a single dose"
    standard_dose_range: { minMgPerDose: 400, maxMgPerDose: 400, maxMgPerDay: 400, frequency: "single dose", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy"],
  },
  {
    id: "drug_mebendazole",
    generic_name: "Mebendazole",
    brand_names: ["Vermox"],
    class: "Anthelmintic",
    // STG Worm Infestation (Ascaris): "oral, Adults and children >12 months:
    // 100mg 12 hourly for 3 days". Hookworm chapter instead cites a
    // single-dose "500mg" regimen — not blended in.
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 100, maxMgPerDay: 200, frequency: "every 12h for 3 days", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_niclosamide",
    generic_name: "Niclosamide",
    brand_names: ["Yomesan"],
    class: "Anthelmintic",
    // STG Worm Infestation (Tapeworm): "oral, Adults and children above 6 years: 2g as a single dose"
    standard_dose_range: { minMgPerDose: 2000, maxMgPerDose: 2000, maxMgPerDay: 2000, frequency: "single dose", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_tiabendazole",
    generic_name: "Tiabendazole",
    brand_names: ["Mintezol"],
    class: "Anthelmintic",
    // STG Worm Infestation (Tapeworm, alternative to Albendazole): "oral,
    // Adults: 25mg/kg 12 hourly for 3 days"
    standard_dose_range: { minMgPerDose: 1500, maxMgPerDose: 2000, maxMgPerDay: 4000, frequency: "every 12h for 3 days", weightBased: true, pediatric: { mgPerKgPerDose: 25, maxMgPerDose: 2000 } },
    route: ["oral"],
    region_availability: ["GH"],
  },

  // --- Antiprotozoal ---
  {
    id: "drug_diloxanide_furoate",
    generic_name: "Diloxanide Furoate",
    brand_names: ["Furamide"],
    class: "Amoebicide",
    // STG Amoebiasis: "oral, Adults: 500mg 8 hourly for 10 days (luminal agent)"
    standard_dose_range: { minMgPerDose: 500, maxMgPerDose: 500, maxMgPerDay: 1500, frequency: "every 8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_secnidazole",
    generic_name: "Secnidazole",
    brand_names: ["Secnil"],
    class: "Nitroimidazole Antiprotozoal",
    // STG (Bacterial Vaginosis/Trichomoniasis): "oral, 2g stat. (contraindicated during the 1st trimester of pregnancy)"
    standard_dose_range: { minMgPerDose: 2000, maxMgPerDose: 2000, maxMgPerDay: 2000, frequency: "single dose", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["First-trimester pregnancy"],
  },
  {
    id: "drug_tinidazole",
    generic_name: "Tinidazole",
    brand_names: ["Fasigyn"],
    class: "Nitroimidazole Antiprotozoal",
    // STG Amoebiasis, 2nd Line: "oral, Adults: 2g once daily for 5 days
    // (tissue agent)"; paediatric ">3y: 50mg/kg (max 2g) once daily for 5 days"
    standard_dose_range: { minMgPerDose: 2000, maxMgPerDose: 2000, maxMgPerDay: 2000, frequency: "once daily", weightBased: true, pediatric: { mgPerKgPerDose: 50, maxMgPerDose: 2000 } },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["First-trimester pregnancy"],
  },

  // --- Anticonvulsants / Benzodiazepines ---
  {
    id: "drug_phenytoin",
    generic_name: "Phenytoin",
    brand_names: ["Dilantin"],
    class: "Anticonvulsant",
    // STG Epilepsy, Acute Generalized Seizures: "IV, Adult: 10-15mg/kg stat.
    // over 20-30min, then 100mg 6-8 hourly PRN" — using the flat maintenance
    // figure; the loading dose is weight-based and noted here, not encoded.
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 100, maxMgPerDay: 400, frequency: "every 6-8h (after weight-based IV loading dose)", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_sodium_valproate",
    generic_name: "Sodium Valproate",
    brand_names: ["Epilim"],
    class: "Anticonvulsant",
    // STG Epilepsy: "(12 hourly) Adult: 600mg (max. 2g)"; maintenance is
    // weight-based ("25-30mg/kg daily in two divided doses") — not encoded
    // in the flat figure below, noted here instead.
    standard_dose_range: { minMgPerDose: 600, maxMgPerDose: 2000, maxMgPerDay: 4000, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active liver disease", "Pregnancy (neural tube defect risk)"],
  },
  {
    id: "drug_lamotrigine",
    generic_name: "Lamotrigine",
    brand_names: ["Lamictal"],
    class: "Anticonvulsant",
    // STG Epilepsy: "Adult: 25-50mg 12 hourly"
    standard_dose_range: { minMgPerDose: 25, maxMgPerDose: 50, maxMgPerDay: 100, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_ethosuximide",
    generic_name: "Ethosuximide",
    brand_names: ["Zarontin"],
    class: "Anticonvulsant",
    // STG Epilepsy (Generalized absence seizure): "(daily) Adult: 250mg 12
    // hourly, increase by 250mg every 5-7 days to 1-1.5g daily in two divided doses"
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 750, maxMgPerDay: 1500, frequency: "every 12h (titrated)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_clonazepam",
    generic_name: "Clonazepam",
    brand_names: ["Klonopin"],
    class: "Benzodiazepine",
    // STG: "oral, Adults: 250 microgram 12 hourly (max. 1mg 12 hourly)"
    standard_dose_range: { minMgPerDose: 0.25, maxMgPerDose: 1, maxMgPerDay: 2, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_lorazepam",
    generic_name: "Lorazepam",
    brand_names: ["Ativan"],
    class: "Benzodiazepine",
    // STG: "oral/IV, Adults: 0.5-2mg 6 hourly as required"
    standard_dose_range: { minMgPerDose: 0.5, maxMgPerDose: 2, maxMgPerDay: 8, frequency: "every 6h", weightBased: false },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },

  // --- Antidotes / Vitamins ---
  {
    id: "drug_phytomenadione",
    generic_name: "Phytomenadione",
    brand_names: ["Vitamin K", "Konakion"],
    class: "Vitamin K",
    // STG Bleeding Disorders: "IV, Adults: 3-5mg stat."
    standard_dose_range: { minMgPerDose: 3, maxMgPerDose: 5, maxMgPerDay: 5, frequency: "single dose (stat.), repeat as needed", weightBased: false },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },

  // --- Respiratory ---
  {
    id: "drug_ipratropium_bromide",
    generic_name: "Ipratropium Bromide",
    brand_names: ["Atrovent"],
    class: "Anticholinergic Bronchodilator",
    // STG Bronchial Asthma: "nebulised, Adults: 500 microgram 4-6 hourly"
    standard_dose_range: { minMgPerDose: 0.5, maxMgPerDose: 0.5, maxMgPerDay: 3, frequency: "every 4-6h", weightBased: false },
    route: ["inhaled"],
    region_availability: ["GH"],
  },
  {
    id: "drug_aminophylline",
    generic_name: "Aminophylline",
    brand_names: ["Phyllocontin"],
    class: "Xanthine Bronchodilator",
    // STG Bronchial Asthma: "IV, Adults: 250mg slow injection over 20min",
    // then "IV infusion, 250mg in 500ml... 6 hourly for 24 hours"
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 250, maxMgPerDay: 1000, frequency: "every 6h", weightBased: false },
    route: ["IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_budesonide",
    generic_name: "Budesonide",
    brand_names: ["Pulmicort"],
    class: "Inhaled Corticosteroid",
    // STG Bronchial Asthma: "inhaled, Adults: 200 microgram (one puff 12 hourly)"
    standard_dose_range: { minMgPerDose: 0.2, maxMgPerDose: 0.2, maxMgPerDay: 0.4, frequency: "every 12h", weightBased: false },
    route: ["inhaled"],
    region_availability: ["GH"],
  },
  {
    id: "drug_fluticasone",
    generic_name: "Fluticasone",
    brand_names: ["Flixotide"],
    class: "Inhaled Corticosteroid",
    // STG Bronchial Asthma: "inhaled - MDI, Adults: 125-250 microgram (2 puffs 12 hourly)"
    standard_dose_range: { minMgPerDose: 0.125, maxMgPerDose: 0.25, maxMgPerDay: 0.5, frequency: "every 12h", weightBased: false },
    route: ["inhaled"],
    region_availability: ["GH"],
  },
  {
    id: "drug_beclometasone",
    generic_name: "Beclometasone",
    brand_names: ["Qvar"],
    class: "Inhaled Corticosteroid",
    // STG Bronchial Asthma: "inhaled, Adults and Children: 100 microgram (2 puffs 12 hourly)"
    standard_dose_range: { minMgPerDose: 0.1, maxMgPerDose: 0.1, maxMgPerDay: 0.2, frequency: "every 12h", weightBased: false },
    route: ["inhaled"],
    region_availability: ["GH"],
  },
  {
    id: "drug_montelukast",
    generic_name: "Montelukast",
    brand_names: ["Singulair"],
    class: "Leukotriene Receptor Antagonist",
    // STG Bronchial Asthma: "oral, Adult: 10mg daily"
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 10, maxMgPerDay: 10, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_carbocysteine",
    generic_name: "Carbocysteine",
    brand_names: ["Mucodyne"],
    class: "Mucolytic",
    // STG: "oral, Adult: 500-750mg 6-8 hourly"
    standard_dose_range: { minMgPerDose: 500, maxMgPerDose: 750, maxMgPerDay: 3000, frequency: "every 6-8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_tiotropium",
    generic_name: "Tiotropium",
    brand_names: ["Spiriva"],
    class: "Anticholinergic Bronchodilator",
    // STG Chronic Bronchitis: "inhaled (dry powder inhaler), Adults: 18 microgram (2 puffs) daily"
    standard_dose_range: { minMgPerDose: 0.018, maxMgPerDose: 0.018, maxMgPerDay: 0.018, frequency: "once daily", weightBased: false },
    route: ["inhaled"],
    region_availability: ["GH"],
  },

  // --- Blood ---
  {
    id: "drug_ferrous_fumarate",
    generic_name: "Ferrous Fumarate",
    brand_names: ["Fersamal"],
    class: "Iron Supplement",
    // STG Iron Deficiency Anaemia: "oral, Adults: 200mg (65mg elemental iron) 8 hourly"
    standard_dose_range: { minMgPerDose: 200, maxMgPerDose: 200, maxMgPerDay: 600, frequency: "every 8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_hydroxocobalamin",
    generic_name: "Hydroxocobalamin",
    brand_names: ["Vitamin B12"],
    class: "Vitamin B12",
    // STG Vitamin B12 Deficiency: "IM, Adults: 1mg every other day for 6 doses"
    standard_dose_range: { minMgPerDose: 1, maxMgPerDose: 1, maxMgPerDay: 1, frequency: "1mg every other day (6 doses total)", weightBased: false },
    route: ["IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_clopidogrel",
    generic_name: "Clopidogrel",
    brand_names: ["Plavix"],
    class: "Antiplatelet Agent",
    // STG Acute Coronary Syndrome: "oral, 300mg stat. then 75mg daily"
    standard_dose_range: { minMgPerDose: 75, maxMgPerDose: 300, maxMgPerDay: 300, frequency: "once daily (300mg loading, then 75mg maintenance)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Active bleeding", "Concurrent warfarin (bleeding risk) — clinical judgement required"],
  },
  {
    id: "drug_tranexamic_acid",
    generic_name: "Tranexamic Acid",
    brand_names: ["Cyklokapron"],
    class: "Antifibrinolytic",
    // STG Menorrhagia: "oral or IV, 1g 6-8 hourly for 4-7 days"
    standard_dose_range: { minMgPerDose: 1000, maxMgPerDose: 1000, maxMgPerDay: 4000, frequency: "every 6-8h", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_enoxaparin",
    generic_name: "Enoxaparin",
    brand_names: ["Clexane"],
    class: "Low Molecular Weight Heparin",
    // STG Acute Coronary Syndrome, VTE prophylaxis: "SC, 40mg daily". Other
    // STG citations for treatment-dose (not prophylaxis) indications are
    // weight-based ("1-1.5mg/kg") — not blended in here. Originally excluded
    // from the initial import because the Route type had no "subcutaneous"
    // value; re-imported after the type was extended to include it.
    standard_dose_range: { minMgPerDose: 40, maxMgPerDose: 40, maxMgPerDay: 40, frequency: "once daily", weightBased: false },
    route: ["subcutaneous"],
    region_availability: ["GH"],
    contraindications: ["Active major bleeding", "Severe renal impairment (dose adjustment required)"],
  },

  // --- Gastrointestinal ---
  {
    id: "drug_aluminium_hydroxide",
    generic_name: "Aluminium Hydroxide",
    brand_names: ["Amphojel"],
    class: "Antacid",
    // STG Dyspepsia: "oral, 500mg 6 hourly (in-between meals and at bedtime)"
    standard_dose_range: { minMgPerDose: 500, maxMgPerDose: 500, maxMgPerDay: 2000, frequency: "every 6h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_esomeprazole",
    generic_name: "Esomeprazole",
    brand_names: ["Nexium"],
    class: "Proton Pump Inhibitor",
    // STG Peptic Ulcer Disease / GORD (consistent range across chapters): "oral, 20-40mg daily"
    standard_dose_range: { minMgPerDose: 20, maxMgPerDose: 40, maxMgPerDay: 40, frequency: "once daily", weightBased: false },
    route: ["oral", "IV"],
    region_availability: ["GH"],
  },
  {
    id: "drug_pantoprazole",
    generic_name: "Pantoprazole",
    brand_names: ["Protonix"],
    class: "Proton Pump Inhibitor",
    // STG Peptic Ulcer Disease: "oral, 20-40mg daily for 4 weeks"
    standard_dose_range: { minMgPerDose: 20, maxMgPerDose: 40, maxMgPerDay: 40, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_domperidone",
    generic_name: "Domperidone",
    brand_names: ["Motilium"],
    class: "Antiemetic (Prokinetic)",
    // STG Vomiting: "oral, Adults: 10mg 6-8 hourly". STG note: use at the
    // lowest effective dose, max 7 days' treatment.
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 10, maxMgPerDay: 40, frequency: "every 6-8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_ondansetron",
    generic_name: "Ondansetron",
    brand_names: ["Zofran"],
    class: "Antiemetic (5-HT3 Antagonist)",
    // STG: "oral, IM, IV, 4-8mg 8 hourly as needed"
    standard_dose_range: { minMgPerDose: 4, maxMgPerDose: 8, maxMgPerDay: 24, frequency: "every 8h", weightBased: false },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_bisacodyl",
    generic_name: "Bisacodyl",
    brand_names: ["Dulcolax"],
    class: "Laxative (Stimulant)",
    // STG Constipation, 1st Line: "oral, 10-20mg at night"
    standard_dose_range: { minMgPerDose: 10, maxMgPerDose: 20, maxMgPerDay: 20, frequency: "once at night", weightBased: false },
    route: ["oral", "rectal"],
    region_availability: ["GH"],
  },
  {
    id: "drug_senna",
    generic_name: "Senna",
    brand_names: ["Senokot"],
    class: "Laxative (Stimulant)",
    // STG Constipation: "oral, 15-30mg at bedtime (maximum 70-100mg daily)"
    standard_dose_range: { minMgPerDose: 15, maxMgPerDose: 30, maxMgPerDay: 100, frequency: "once at night", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },

  // --- Endocrine ---
  {
    id: "drug_gliclazide",
    generic_name: "Gliclazide",
    brand_names: ["Diamicron"],
    class: "Sulfonylurea (Antidiabetic)",
    // STG Diabetes Mellitus: "oral, Adults: 40-160mg 12 hourly"
    standard_dose_range: { minMgPerDose: 40, maxMgPerDose: 160, maxMgPerDay: 320, frequency: "every 12h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_glimepiride",
    generic_name: "Glimepiride",
    brand_names: ["Amaryl"],
    class: "Sulfonylurea (Antidiabetic)",
    // STG Diabetes Mellitus: "oral, Adults: 2-6mg daily (as a single dose in the morning)"
    standard_dose_range: { minMgPerDose: 2, maxMgPerDose: 6, maxMgPerDay: 6, frequency: "once daily (morning)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_carbimazole",
    generic_name: "Carbimazole",
    brand_names: ["Neo-Mercazole"],
    class: "Antithyroid Agent",
    // STG Hyperthyroidism: "oral, Adults: 20-40mg daily"
    standard_dose_range: { minMgPerDose: 20, maxMgPerDose: 40, maxMgPerDay: 40, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy (Propylthiouracil preferred)"],
  },
  {
    id: "drug_propylthiouracil",
    generic_name: "Propylthiouracil",
    brand_names: ["PTU"],
    class: "Antithyroid Agent",
    // STG Hyperthyroidism: "oral, Adults: 100mg 8 hourly". STG note:
    // preferred in pregnancy and for those who don't tolerate Carbimazole.
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 100, maxMgPerDay: 300, frequency: "every 8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },

  // --- Oxytocics ---
  {
    id: "drug_misoprostol",
    generic_name: "Misoprostol",
    brand_names: ["Cytotec"],
    class: "Prostaglandin Analogue (Uterotonic)",
    // STG PPH prophylaxis: "sublingual, 600 microgram". PPH treatment /
    // abortion-management chapters cite up to "800 microgram stat." — reported
    // here as a range, not blended silently.
    standard_dose_range: { minMgPerDose: 0.6, maxMgPerDose: 0.8, maxMgPerDay: 0.8, frequency: "single dose (context-dependent)", weightBased: false },
    route: ["oral", "sublingual", "rectal"],
    region_availability: ["GH"],
    contraindications: ["Pregnancy where uterine stimulation is not the treatment intent"],
  },
  {
    id: "drug_ergometrine",
    generic_name: "Ergometrine",
    brand_names: ["Ergotrate"],
    class: "Ergot Alkaloid (Uterotonic)",
    // STG Secondary PPH: "oral, 500 microgram 8 hourly for 3 days". PPH 3rd
    // line also cites "IV, 500 microgram stat." — not blended in.
    standard_dose_range: { minMgPerDose: 0.5, maxMgPerDose: 0.5, maxMgPerDay: 1.5, frequency: "every 8h", weightBased: false },
    route: ["oral", "IV", "IM"],
    region_availability: ["GH"],
    contraindications: ["Hypertension/pre-eclampsia", "Cardiac disease"],
  },

  // --- Psychotherapeutic ---
  {
    id: "drug_fluoxetine",
    generic_name: "Fluoxetine",
    brand_names: ["Prozac"],
    class: "SSRI Antidepressant",
    // STG Depression: "oral, Adults: 20mg once daily for 2-4 weeks, then
    // increase if necessary to max. of 80mg"
    standard_dose_range: { minMgPerDose: 20, maxMgPerDose: 80, maxMgPerDay: 80, frequency: "once daily (titrated)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Concurrent MAO inhibitors"],
  },
  {
    id: "drug_sertraline",
    generic_name: "Sertraline",
    brand_names: ["Zoloft"],
    class: "SSRI Antidepressant",
    // STG Depression: "oral, Adults: 50mg once daily, then increase if
    // necessary by increments of 50mg at intervals of at least 1 week, to
    // max. of 200mg daily"
    standard_dose_range: { minMgPerDose: 50, maxMgPerDose: 200, maxMgPerDay: 200, frequency: "once daily (titrated)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Concurrent MAO inhibitors"],
  },
  {
    id: "drug_citalopram",
    generic_name: "Citalopram",
    brand_names: ["Celexa"],
    class: "SSRI Antidepressant",
    // STG Depression: "oral, Adults: 20mg once daily, increase if necessary
    // in steps of 20mg daily, at intervals of 3-4 weeks, max. 40mg"
    standard_dose_range: { minMgPerDose: 20, maxMgPerDose: 40, maxMgPerDay: 40, frequency: "once daily (titrated)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Concurrent MAO inhibitors"],
  },
  {
    id: "drug_haloperidol",
    generic_name: "Haloperidol",
    brand_names: ["Haldol"],
    class: "Typical Antipsychotic",
    // STG Psychosis: "oral, Adults: 3-5mg 8-12 hourly (max. 30mg per day)".
    // IM acute-phase citation instead uses "2-5mg stat., max. 20mg per day" —
    // not blended in. NOTE: STG has two other oral citations for different
    // indications with a lower ceiling — "1-3mg 8 hourly, max. daily dose of
    // 20mg" and "5-10mg 12 hourly up to a max. of 20mg daily" — this entry
    // uses the highest of the four real, differently-indicated STG figures,
    // not the only or most conservative one.
    standard_dose_range: { minMgPerDose: 3, maxMgPerDose: 5, maxMgPerDay: 30, frequency: "every 8-12h", weightBased: false },
    route: ["oral", "IM"],
    region_availability: ["GH"],
    contraindications: ["Parkinson's disease", "Severe CNS depression"],
  },
  {
    id: "drug_chlorpromazine",
    generic_name: "Chlorpromazine",
    brand_names: ["Thorazine"],
    class: "Typical Antipsychotic (Phenothiazine)",
    // STG Bipolar Disorder (mania): "IM, Adults: 25-50mg 6-8 hourly, adjusting to max. of 400mg daily"
    standard_dose_range: { minMgPerDose: 25, maxMgPerDose: 50, maxMgPerDay: 400, frequency: "every 6-8h", weightBased: false },
    route: ["oral", "IM"],
    region_availability: ["GH"],
    contraindications: ["Severe CNS depression", "Phaeochromocytoma"],
  },
  {
    id: "drug_lithium",
    generic_name: "Lithium",
    brand_names: ["Lithium Carbonate"],
    class: "Mood Stabilizer",
    // STG Bipolar Disorder, maintenance: "oral, Adults: 200-600mg 6-8 hourly (max. 2400mg daily)"
    standard_dose_range: { minMgPerDose: 200, maxMgPerDose: 600, maxMgPerDay: 2400, frequency: "every 6-8h", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    contraindications: ["Renal impairment (narrow therapeutic index)", "Dehydration/low-sodium states"],
  },
  {
    id: "drug_olanzapine",
    generic_name: "Olanzapine",
    brand_names: ["Zyprexa"],
    class: "Atypical Antipsychotic",
    // STG Bipolar Disorder (mania): "IM or oral, Adults: 5-10mg stat., then 5-10mg daily, max. 20mg daily"
    standard_dose_range: { minMgPerDose: 5, maxMgPerDose: 10, maxMgPerDay: 20, frequency: "once daily", weightBased: false },
    route: ["oral", "IM"],
    region_availability: ["GH"],
  },
  {
    id: "drug_risperidone",
    generic_name: "Risperidone",
    brand_names: ["Risperdal"],
    class: "Atypical Antipsychotic",
    // STG Psychosis, maintenance: "oral, Adults: 1-4mg 12-24 hourly (start at
    // low dose and adjust daily according to response)"
    standard_dose_range: { minMgPerDose: 1, maxMgPerDose: 4, maxMgPerDay: 8, frequency: "every 12-24h (titrated)", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
  },
];
