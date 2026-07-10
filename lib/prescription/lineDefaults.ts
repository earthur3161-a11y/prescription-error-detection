import { generateId } from "../utils/id";
import type { Drug, PrescriptionDrugLine } from "../types";

function guessFrequencyPerDay(frequency: string): number {
  const f = frequency.toLowerCase();
  if (f.includes("once") || f.includes("single dose")) return 1;
  if (f.includes("twice") || f.includes("two times")) return 2;
  if (f.includes("three times") || f.includes("8h")) return 3;
  if (f.includes("4-6h") || f.includes("four times")) return 4;
  return 2;
}

export function buildDefaultLine(drug: Drug): PrescriptionDrugLine {
  return {
    id: generateId("line"),
    drugId: drug.id,
    form: "tablet",
    strengthMg: drug.standard_dose_range.minMgPerDose,
    route: drug.route[0],
    doseMg: drug.standard_dose_range.minMgPerDose,
    frequencyPerDay: guessFrequencyPerDay(drug.standard_dose_range.frequency),
    durationDays: 5,
  };
}
