import type { FoodInteractionRule } from "../../types";

/**
 * Drug-food interaction reference data. Sourcing methodology (confirmed with
 * the user before this file was written):
 *
 * - Primary source: FDA-approved drug labels (accessdata.fda.gov), the same
 *   standard already used in interactionRules.ts for drug-drug interactions.
 *   Cross-referenced against PubMed/NCBI literature where a label states a
 *   restriction without a mechanism or magnitude. Not a Ghana-specific
 *   source — this category of fact (how a drug's absorption/effect changes
 *   with food or alcohol) is general pharmacology, not a national-formulary
 *   treatment convention, the same reasoning interactionRules.ts already
 *   documents for drug-drug interactions.
 * - Every entry below was verified against a real, checkable source during
 *   this session — none are recalled from memory and presented as sourced.
 *   Class-level entries (the same finding applied to every drug that shares
 *   the causative mechanism, e.g. fluoroquinolone chelation by dairy) are
 *   marked as such in the comment; only one member of the class was directly
 *   checked against a primary source, the rest share the identical,
 *   well-established mechanism.
 * - Where a candidate was checked and the interaction was confirmed NOT to
 *   apply (e.g. rosuvastatin + grapefruit), or sourcing came up short, it's
 *   logged in `foodInteractionExcluded` below with a specific reason —
 *   nothing was silently dropped, matching emlExpansion.ts's own convention.
 * - This is NOT an exhaustive pass over all 144 formulary drugs — it covers
 *   the highest-confidence, most clinically significant candidates. A drug
 *   absent from both this file and the excluded list simply hasn't been
 *   researched yet, which is a different status from "confirmed no
 *   interaction" (which IS logged, when found).
 */

export const ghanaFoodInteractionRules: FoodInteractionRule[] = [
  {
    id: "food_warfarin_vitamin_k",
    drug_id: "drug_warfarin",
    severity: "moderate",
    food: "Vitamin K-rich leafy greens (e.g. kale, spinach, collard greens) in large or drastically-changing amounts",
    description:
      "Vitamin K opposes warfarin's mechanism of action. A large or sudden change in vitamin K intake can meaningfully shift INR. The guidance is consistency, not avoidance.",
    guidance: "Keep vitamin K intake roughly consistent week to week — do not suddenly start or stop eating large amounts of leafy greens.",
    referenceSource: "FDA warfarin sodium label — advises a normal, consistent-vitamin-K diet and avoiding drastic changes such as large amounts of green leafy vegetables.",
  },
  {
    id: "food_ciprofloxacin_dairy",
    drug_id: "drug_ciprofloxacin",
    severity: "moderate",
    food: "Dairy products and calcium-fortified foods/juices, alone (not as part of a full meal)",
    description:
      "Calcium and other multivalent cations chelate ciprofloxacin in the gut, significantly reducing absorption.",
    guidance: "Do not take with milk, yogurt, or calcium-fortified drinks alone; a meal containing dairy is fine.",
    referenceSource: "FDA CIPRO XR (ciprofloxacin) label — absorption significantly reduced by concomitant multivalent-cation products including dairy/calcium.",
  },
  {
    id: "food_levofloxacin_dairy",
    drug_id: "drug_levofloxacin",
    severity: "moderate",
    food: "Dairy products and calcium-fortified foods/juices, alone",
    description:
      "Class-level fluoroquinolone finding — the same multivalent-cation chelation mechanism confirmed for ciprofloxacin applies to the whole class; levofloxacin itself was not individually re-verified against its own label this session.",
    guidance: "Do not take with milk, yogurt, or calcium-fortified drinks alone; a meal containing dairy is fine.",
    referenceSource: "Class extension from FDA CIPRO XR label (chelation by multivalent cations is a fluoroquinolone-class absorption mechanism, not cipro-specific).",
  },
  {
    id: "food_norfloxacin_dairy",
    drug_id: "drug_norfloxacin",
    severity: "moderate",
    food: "Dairy products and calcium-fortified foods/juices, alone",
    description: "Class-level fluoroquinolone finding — see levofloxacin entry.",
    guidance: "Do not take with milk, yogurt, or calcium-fortified drinks alone; a meal containing dairy is fine.",
    referenceSource: "Class extension from FDA CIPRO XR label (chelation by multivalent cations is a fluoroquinolone-class absorption mechanism, not cipro-specific).",
  },
  {
    id: "food_doxycycline_dairy_iron",
    drug_id: "drug_doxycycline",
    severity: "moderate",
    food: "Dairy products, calcium/iron supplements, and mineral antacids",
    description:
      "Chelation by calcium/iron reduces peak plasma concentration by roughly 24% and overall absorption by 9-53% (mean ~30%) when taken with milk.",
    guidance: "Separate from dairy, iron, and mineral antacids by at least 2 hours.",
    referenceSource: "FDA doxycycline label; quantified milk-interaction studies (impaired absorption via chelation).",
  },
  {
    id: "food_tetracycline_dairy_iron",
    drug_id: "drug_tetracycline",
    severity: "moderate",
    food: "Dairy products, calcium/iron supplements, and mineral antacids",
    description: "Milk reduces tetracycline absorption by approximately 65% via chelation — a larger effect than for doxycycline.",
    guidance: "Separate from dairy, iron, and mineral antacids by at least 2 hours.",
    referenceSource: "FDA tetracycline label; quantified milk-interaction studies.",
  },
  {
    id: "food_simvastatin_grapefruit",
    drug_id: "drug_simvastatin",
    severity: "major",
    food: "Grapefruit and grapefruit juice",
    description: "Grapefruit furanocoumarins inhibit intestinal CYP3A4, increasing simvastatin exposure roughly 9-fold (peak) to 16-fold (total AUC) — the strongest statin-grapefruit interaction of the three checked.",
    guidance: "Avoid grapefruit and grapefruit juice entirely while taking this drug.",
    referenceSource: "FDA simvastatin label; grapefruit-juice pharmacokinetic interaction studies (CYP3A4 inhibition).",
  },
  {
    id: "food_atorvastatin_grapefruit",
    drug_id: "drug_atorvastatin",
    severity: "moderate",
    food: "Grapefruit and grapefruit juice",
    description: "Same CYP3A4 mechanism as simvastatin, with a smaller but still clinically meaningful effect (~2.5-fold increase in total exposure).",
    guidance: "Avoid regular/large amounts of grapefruit and grapefruit juice while taking this drug.",
    referenceSource: "FDA atorvastatin label; grapefruit-juice pharmacokinetic interaction studies.",
  },
  {
    id: "food_levothyroxine_food_calcium_iron",
    drug_id: "drug_levothyroxine",
    severity: "moderate",
    food: "Food in general, plus calcium, iron, and coffee specifically",
    description: "Levothyroxine absorption drops significantly when taken with food; calcium and iron can reduce absorption by up to 50% via binding in the gut, and coffee has also been shown to reduce bioavailability.",
    guidance: "Take on an empty stomach, 30-60 minutes before breakfast; separate calcium/iron supplements and antacids by at least 4 hours.",
    referenceSource: "FDA levothyroxine label — recommends empty-stomach dosing and a 4-hour separation from calcium/iron/antacids.",
  },
  {
    id: "food_ferrous_sulfate_tea_coffee_calcium",
    drug_id: "drug_ferrous_sulfate",
    severity: "minor",
    food: "Tea, coffee, and calcium/dairy (reduce absorption); vitamin C-rich foods (increase absorption)",
    description: "Tannins/polyphenols in tea (reported up to ~85% reduction) and coffee (~54%), and calcium (~18-27%), bind non-heme iron and reduce absorption; vitamin C converts iron to a more absorbable form and can increase absorption several-fold.",
    guidance: "Separate from tea, coffee, and dairy/calcium by about 2 hours; pairing with a vitamin C source can improve absorption.",
    referenceSource: "Controlled iron-absorption studies quantifying tea/coffee/calcium inhibition and vitamin C enhancement.",
  },
  {
    id: "food_ferrous_fumarate_tea_coffee_calcium",
    drug_id: "drug_ferrous_fumarate",
    severity: "minor",
    food: "Tea, coffee, and calcium/dairy (reduce absorption); vitamin C-rich foods (increase absorption)",
    description: "Same non-heme iron chelation/enhancement mechanism as ferrous sulfate — both are iron salts, not two independently-sourced findings.",
    guidance: "Separate from tea, coffee, and dairy/calcium by about 2 hours; pairing with a vitamin C source can improve absorption.",
    referenceSource: "Controlled iron-absorption studies quantifying tea/coffee/calcium inhibition and vitamin C enhancement (see ferrous sulfate entry).",
  },
  {
    id: "food_lisinopril_potassium",
    drug_id: "drug_lisinopril",
    severity: "moderate",
    food: "Potassium-rich foods and salt substitutes (potassium chloride-based, e.g. \"NoSalt\"/\"Nu-Salt\")",
    description: "ACE inhibitors reduce potassium excretion; combined with a high dietary potassium load this raises hyperkalemia risk, especially with impaired renal function.",
    guidance: "Avoid potassium-based salt substitutes; discuss high-potassium diets with a prescriber.",
    referenceSource: "Clinical hyperkalemia-risk literature on RAAS-inhibiting drugs plus dietary/salt-substitute potassium load.",
  },
  {
    id: "food_enalapril_potassium",
    drug_id: "drug_enalapril",
    severity: "moderate",
    food: "Potassium-rich foods and salt substitutes",
    description: "Class-level ACE inhibitor finding — see lisinopril entry.",
    guidance: "Avoid potassium-based salt substitutes; discuss high-potassium diets with a prescriber.",
    referenceSource: "Class extension — RAAS-inhibition/hyperkalemia mechanism common to all ACE inhibitors.",
  },
  {
    id: "food_ramipril_potassium",
    drug_id: "drug_ramipril",
    severity: "moderate",
    food: "Potassium-rich foods and salt substitutes",
    description: "Class-level ACE inhibitor finding — see lisinopril entry.",
    guidance: "Avoid potassium-based salt substitutes; discuss high-potassium diets with a prescriber.",
    referenceSource: "Class extension — RAAS-inhibition/hyperkalemia mechanism common to all ACE inhibitors.",
  },
  {
    id: "food_losartan_potassium",
    drug_id: "drug_losartan",
    severity: "moderate",
    food: "Potassium-rich foods and salt substitutes",
    description: "Same RAAS-inhibition/hyperkalemia mechanism as ACE inhibitors, class-level for ARBs.",
    guidance: "Avoid potassium-based salt substitutes; discuss high-potassium diets with a prescriber.",
    referenceSource: "Class extension — RAAS-inhibition/hyperkalemia mechanism common to ARBs.",
  },
  {
    id: "food_candesartan_potassium",
    drug_id: "drug_candesartan",
    severity: "moderate",
    food: "Potassium-rich foods and salt substitutes",
    description: "Class-level ARB finding — see losartan entry.",
    guidance: "Avoid potassium-based salt substitutes; discuss high-potassium diets with a prescriber.",
    referenceSource: "Class extension — RAAS-inhibition/hyperkalemia mechanism common to ARBs.",
  },
  {
    id: "food_valsartan_potassium",
    drug_id: "drug_valsartan",
    severity: "moderate",
    food: "Potassium-rich foods and salt substitutes",
    description: "Class-level ARB finding — see losartan entry.",
    guidance: "Avoid potassium-based salt substitutes; discuss high-potassium diets with a prescriber.",
    referenceSource: "Class extension — RAAS-inhibition/hyperkalemia mechanism common to ARBs.",
  },
  {
    id: "food_spironolactone_potassium",
    drug_id: "drug_spironolactone",
    severity: "major",
    food: "Potassium-rich foods and salt substitutes",
    description: "Spironolactone is itself a potassium-sparing diuretic, so the hyperkalemia risk from additional dietary potassium is more direct and pronounced than for ACE inhibitors/ARBs.",
    guidance: "Avoid potassium-based salt substitutes and high-potassium diets unless directed by a prescriber; this is a stronger caution than for ACE inhibitors/ARBs given the drug's own potassium-sparing mechanism.",
    referenceSource: "Clinical hyperkalemia literature on potassium-sparing diuretics plus dietary potassium load.",
  },
  {
    id: "food_nifedipine_grapefruit",
    drug_id: "drug_nifedipine",
    severity: "major",
    food: "Grapefruit and grapefruit juice",
    description: "Grapefruit juice more than doubles nifedipine's AUC via CYP3A4 inhibition; the manufacturer's own labeling recommends avoidance.",
    guidance: "Avoid grapefruit and grapefruit juice entirely while taking this drug.",
    referenceSource: "Grapefruit-juice/nifedipine pharmacokinetic interaction studies; manufacturer labeling recommends avoidance.",
  },
  {
    id: "food_carbamazepine_grapefruit",
    drug_id: "drug_carbamazepine",
    severity: "major",
    food: "Grapefruit, grapefruit juice, and related citrus (pomegranate, star fruit)",
    description: "CYP3A4 inhibition significantly raises carbamazepine blood levels, increasing toxicity risk (a narrow-therapeutic-index drug).",
    guidance: "Avoid regular consumption of grapefruit and grapefruit juice while taking this drug.",
    referenceSource: "Carbamazepine-grapefruit juice pharmacokinetic interaction literature.",
  },
  {
    id: "food_lithium_sodium",
    drug_id: "drug_lithium",
    severity: "moderate",
    food: "Dietary sodium/salt intake, especially sudden decreases",
    description: "The kidneys handle lithium and sodium similarly — a sudden drop in salt intake (or significant fluid loss from sweating/diarrhea) reduces lithium clearance and raises toxicity risk; a sudden large increase can reduce lithium's effectiveness.",
    guidance: "Maintain a normal, consistent salt and fluid intake; don't start a low-salt diet without medical supervision, and seek advice after significant fluid/salt loss (e.g. prolonged vomiting, diarrhea, heavy sweating).",
    referenceSource: "FDA lithium carbonate label — advises a normal diet including salt and adequate fluid intake, and flags altered tolerance after fluid/salt loss.",
  },
  {
    id: "food_itraconazole_food_timing",
    drug_id: "drug_itraconazole",
    severity: "minor",
    food: "Food in general (capsule formulation)",
    description: "Unlike most entries in this file, this is an absorption-enhancing interaction, not a reduction: itraconazole capsules are poorly absorbed on an empty stomach (bioavailability ~54% of the fed value) and need food for adequate levels.",
    guidance: "Take capsules with a full meal, not on an empty stomach — the opposite guidance from most drugs in this list.",
    referenceSource: "Itraconazole capsule food-effect bioavailability studies.",
  },
  {
    id: "food_colchicine_grapefruit",
    drug_id: "drug_colchicine",
    severity: "severe",
    food: "Grapefruit and grapefruit juice",
    description: "Grapefruit inhibits both CYP3A4 and P-glycoprotein, colchicine's clearance pathways — a narrow-therapeutic-index drug where increased exposure has caused documented severe toxicity (myopathy, multiorgan failure) in case reports.",
    guidance: "Avoid grapefruit and grapefruit juice entirely — this combination has a documented severe-toxicity case history.",
    referenceSource: "FDA colchicine label (moderate CYP3A4 inhibitor dose-adjustment guidance) plus a published pediatric case report of grapefruit-juice-associated colchicine toxicity progressing to multiorgan failure.",
  },
];

export const foodInteractionExcluded: { candidate: string; reason: string }[] = [
  { candidate: "Rosuvastatin + grapefruit", reason: "Confirmed NOT significantly affected — rosuvastatin is primarily metabolized via CYP2C9, not CYP3A4 (unlike simvastatin/atorvastatin). This is a confirmed absence of interaction, not a sourcing gap." },
  { candidate: "Amlodipine + grapefruit", reason: "Multiple pharmacokinetic studies found grapefruit juice has no appreciable effect on amlodipine's pharmacokinetics or pharmacodynamics, despite amlodipine being a CCB like nifedipine. Confirmed absence, not a sourcing gap." },
  { candidate: "Verapamil + grapefruit", reason: "No reliable, specific verapamil-grapefruit interaction data located — available sources covered verapamil's other drug-drug interactions, not grapefruit specifically. Excluded for insufficient direct sourcing, not confirmed absence." },
  { candidate: "Phenytoin + grapefruit", reason: "No clear phenytoin-grapefruit interaction located, unlike carbamazepine (also an anticonvulsant, but a much stronger CYP3A4 substrate). Insufficient sourcing to support extending the carbamazepine finding by class." },
  { candidate: "Fluconazole + food", reason: "FDA label explicitly states fluconazole tablets can be taken with or without food (unlike itraconazole capsules) — confirmed absence of a food-timing interaction, not a sourcing gap." },
  { candidate: "Digoxin + high-fiber food/bran", reason: "Documented in the historical Lanoxin label, but multiple controlled pharmacokinetic studies found the effect too small to matter clinically (commonly cited as <15%, several concluding 'not clinically important' or finding no measurable effect at all). Excluded to avoid raising a caution flag with no real clinically-actionable magnitude behind it — a clinical-significance judgment call, not a sourcing failure." },
];
