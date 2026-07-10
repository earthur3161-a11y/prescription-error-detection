import type { DrugLineVerdict, Verdict } from "./types";

const SEVERITY_ORDER: Record<Verdict, number> = { safe: 0, caution: 1, blocked: 2 };

/** Worst-case verdict across all lines of a prescription, for list/summary display. */
export function overallVerdict(verdicts: DrugLineVerdict[]): Verdict {
  if (verdicts.length === 0) return "safe";
  return verdicts.reduce<Verdict>(
    (worst, v) => (SEVERITY_ORDER[v.verdict] > SEVERITY_ORDER[worst] ? v.verdict : worst),
    "safe"
  );
}
