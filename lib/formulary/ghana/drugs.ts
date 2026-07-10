import type { Drug } from "../../types";
import { ghanaDrugsExtended } from "./drugsExtended";

// NOTE ON CLINICAL FIELDS (pregnancyCategory / renal- & hepaticDoseGuidance):
// These are illustrative demo values for well-established, textbook cases only
// (e.g. warfarin/ARBs in pregnancy, metformin in renal impairment). They are
// NOT an authoritative dosing source and are deliberately left undefined for
// drugs where the answer is nuanced — undefined simply means "not categorised"
// and the engine falls back to contraindication text rather than guessing.
const baseDrugs: Omit<Drug, "onEssentialMedicinesList" | "emlAlternativeDrugId">[] = [
  {
    id: "drug_paracetamol",
    pregnancyCategory: "B",
    hepaticDoseGuidance: "caution",
    generic_name: "Paracetamol",
    brand_names: ["Panadol"],
    class: "Analgesic/Antipyretic",
    standard_dose_range: {
      minMgPerDose: 500,
      maxMgPerDose: 1000,
      maxMgPerDay: 4000,
      frequency: "every 4-6h",
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
    standard_dose_range: {
      minMgPerDose: 250,
      maxMgPerDose: 500,
      maxMgPerDay: 1500,
      frequency: "every 8h",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 25, maxMgPerDose: 500 },
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_artemether_lumefantrine",
    generic_name: "Artemether-Lumefantrine",
    brand_names: ["Coartem"],
    class: "Antimalarial",
    standard_dose_range: {
      minMgPerDose: 80,
      maxMgPerDose: 480,
      maxMgPerDay: 960,
      frequency: "twice daily for 3 days",
      weightBased: true,
      pediatric: { mgPerKgPerDose: 6, maxMgPerDose: 480 },
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
    id: "drug_losartan",
    pregnancyCategory: "D",
    generic_name: "Losartan",
    brand_names: ["Cozaar"],
    class: "Angiotensin Receptor Blocker",
    standard_dose_range: {
      minMgPerDose: 25,
      maxMgPerDose: 100,
      maxMgPerDay: 100,
      frequency: "once daily",
      weightBased: false,
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
    standard_dose_range: {
      minMgPerDose: 1,
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
    standard_dose_range: {
      minMgPerDose: 75,
      maxMgPerDose: 300,
      maxMgPerDay: 4000,
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
    standard_dose_range: {
      minMgPerDose: 200,
      maxMgPerDose: 400,
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
    standard_dose_range: {
      minMgPerDose: 50,
      maxMgPerDose: 75,
      maxMgPerDay: 150,
      frequency: "twice daily",
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
    standard_dose_range: {
      minMgPerDose: 1000,
      maxMgPerDose: 2000,
      maxMgPerDay: 4000,
      frequency: "once or twice daily",
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
    standard_dose_range: {
      minMgPerDose: 250,
      maxMgPerDose: 750,
      maxMgPerDay: 1500,
      frequency: "twice daily",
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
    standard_dose_range: {
      minMgPerDose: 5,
      maxMgPerDose: 60,
      maxMgPerDay: 60,
      frequency: "once daily",
      weightBased: false,
    },
    route: ["oral"],
    region_availability: ["GH"],
  },
  {
    id: "drug_insulin_actrapid",
    generic_name: "Insulin (Actrapid)",
    brand_names: ["Actrapid"],
    class: "Insulin",
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
    standard_dose_range: {
      minMgPerDose: 2.5,
      maxMgPerDose: 10,
      maxMgPerDay: 20,
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
    standard_dose_range: {
      minMgPerDose: 20,
      maxMgPerDose: 80,
      maxMgPerDay: 160,
      frequency: "once or twice daily",
      weightBased: false,
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
    standard_dose_range: {
      minMgPerDose: 2,
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
    standard_dose_range: {
      minMgPerDose: 4,
      maxMgPerDose: 4,
      maxMgPerDay: 24,
      frequency: "every 4-6h",
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
    standard_dose_range: {
      minMgPerDose: 480,
      maxMgPerDose: 960,
      maxMgPerDay: 1920,
      frequency: "twice daily",
      weightBased: false,
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
 */
const NOT_ON_EML: Record<string, string | undefined> = {
  // ARB — Ghana STG favors first-line agents (e.g. calcium channel blockers) for uncomplicated hypertension.
  drug_losartan: "drug_amlodipine",
  // Superseded by artemether-lumefantrine (ACT) as first-line treatment for uncomplicated malaria; retained only for IPTp.
  drug_sulfadoxine_pyrimethamine: "drug_artemether_lumefantrine",
  // Newer macrolide — erythromycin/azithromycin are the EML-listed choices.
  drug_clarithromycin: "drug_erythromycin",
  // Reserve fluoroquinolone — ciprofloxacin is the EML-listed first choice.
  drug_levofloxacin: "drug_ciprofloxacin",
  // Simvastatin is the EML-listed statin.
  drug_atorvastatin: "drug_simvastatin",
  // Atenolol is the EML-listed beta blocker.
  drug_bisoprolol: "drug_atenolol",
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
