// Curated list of patient-facing reasons for a prescription, each mapped to
// the drug classes generally used to treat it. Deliberately class-level
// (matching the `Drug.class` taxonomy already used throughout the formulary)
// rather than per-drug — Ghana STG/EML data doesn't carry a structured
// per-drug indication field, and a drug's therapeutic class is the most
// reliable, sourced signal available for "is this medicine plausible for
// what the patient told us." This is standard textbook drug-class-to-use
// mapping (e.g. NSAIDs treat pain, ACE inhibitors treat hypertension), not a
// dosing or interaction fact requiring its own citation.
//
// Coverage is intentionally conservative: a class left out of every mapping
// here simply means the indication check stays silent for it, never that
// it's flagged as wrong. See indicationCheck.ts for how this is used.
export const PATIENT_CONDITIONS = [
  "Pain or fever",
  "Bacterial infection",
  "Malaria",
  "Diabetes",
  "High blood pressure",
  "Heart failure or irregular heartbeat",
  "Blood clot or stroke prevention",
  "Stomach or digestive problems",
  "Asthma or breathing problems",
  "Allergy or cold symptoms",
  "Anxiety, sleep problems, or seizures",
  "High cholesterol",
  "Fungal infection",
  "Viral infection",
  "Low blood count, anaemia, or vitamin/nutrient deficiency",
  "Thyroid problem",
  "Nausea or vomiting",
] as const;

export type PatientCondition = (typeof PATIENT_CONDITIONS)[number];

export const CONDITION_TO_DRUG_CLASSES: Record<PatientCondition, string[]> = {
  "Pain or fever": ["Analgesic/Antipyretic", "NSAID", "Opioid Analgesic"],
  "Bacterial infection": [
    "Penicillin",
    "Cephalosporin",
    "Macrolide",
    "Tetracycline",
    "Nitrofuran",
    "Aminoglycoside",
    "Fluoroquinolone",
    "Nitroimidazole",
    "Antifolate Antibacterial",
  ],
  Malaria: ["Antimalarial", "Antifolate Antimalarial"],
  Diabetes: ["Biguanide (Antidiabetic)", "Sulfonylurea (Antidiabetic)", "Insulin"],
  "High blood pressure": [
    "Calcium Channel Blocker",
    "Angiotensin Receptor Blocker",
    "ACE Inhibitor",
    "Beta Blocker",
    "Centrally-acting Antihypertensive",
    "Thiazide Diuretic",
    "Loop Diuretic",
    "Potassium-sparing Diuretic",
  ],
  "Heart failure or irregular heartbeat": ["Cardiac Glycoside", "Beta Blocker", "Loop Diuretic", "Potassium-sparing Diuretic"],
  "Blood clot or stroke prevention": ["Anticoagulant"],
  "Stomach or digestive problems": ["Proton Pump Inhibitor", "Antispasmodic", "Antiemetic (Prokinetic)"],
  "Asthma or breathing problems": ["Beta-2 Agonist (Bronchodilator)", "Corticosteroid"],
  "Allergy or cold symptoms": ["Antihistamine"],
  "Anxiety, sleep problems, or seizures": ["Benzodiazepine", "Anticonvulsant", "Tricyclic Antidepressant"],
  "High cholesterol": ["Statin"],
  "Fungal infection": ["Azole Antifungal"],
  "Viral infection": ["Antiviral"],
  "Low blood count, anaemia, or vitamin/nutrient deficiency": ["Vitamin Supplement", "Iron Supplement"],
  "Thyroid problem": ["Thyroid Hormone"],
  "Nausea or vomiting": ["Antiemetic (Prokinetic)"],
};
