import { buildFlag } from "../buildFlag";
import type { Flag, ScreeningInput } from "../types";

/**
 * Cross-line cumulative daily-dose check. The per-line dose check
 * (doseRangeCheck) can pass every individual line while the SAME drug,
 * ordered on more than one line, adds up to an unsafe daily total — a classic
 * double-prescribing / duplicate-order overdose. This sums every line of the
 * current line's drug and flags when the combined daily dose exceeds the
 * standard maximum. It only fires when the drug appears on ≥2 lines, so it
 * never duplicates the single-line max_daily_dose flag.
 */
export function checkCumulativeDose(input: ScreeningInput): Flag[] {
  const { drugLine, otherLines, formulary } = input;

  const drug = formulary.drugs.find((d) => d.id === drugLine.drugId);
  if (!drug) return [];

  const sameDrugLines = [
    drugLine,
    ...otherLines.filter((l) => l.id !== drugLine.id && l.drugId === drugLine.drugId),
  ];
  if (sameDrugLines.length < 2) return [];

  const cumulativeMgPerDay = sameDrugLines.reduce(
    (sum, l) => sum + l.doseMg * l.frequencyPerDay,
    0
  );
  const maxMgPerDay = drug.standard_dose_range.maxMgPerDay;

  if (cumulativeMgPerDay > maxMgPerDay) {
    return [
      buildFlag({
        type: "max_daily_dose",
        code: "CUMULATIVE_DOSE_ABOVE_MAX_PER_DAY",
        severity: "severe",
        clinical: `${drug.generic_name} appears on ${sameDrugLines.length} lines of this prescription totalling ${cumulativeMgPerDay}mg/day — exceeding the standard maximum of ${maxMgPerDay}mg/day. Combine the orders or reduce the total daily dose to ≤${maxMgPerDay}mg.`,
        patient: `${drug.generic_name} is on this prescription more than once, and together they add up to more than the safe daily amount.`,
        relatedDrugId: drug.id,
      }),
    ];
  }

  return [];
}
