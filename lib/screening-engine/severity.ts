import type { Flag, Verdict } from "./types";

/**
 * Floors the verdict at "caution" for any flag whose severity isn't
 * confidently "none" — including "unknown" (missing data). A drug line can
 * only ever resolve to "safe" when every check ran with complete data and
 * found nothing. This must stay the single source of truth for verdict
 * derivation so no caller can accidentally treat missing data as safe.
 */
export function deriveVerdict(flags: Flag[]): Verdict {
  if (flags.some((f) => f.severity === "severe" || f.severity === "major")) {
    return "blocked";
  }
  if (
    flags.some(
      (f) =>
        f.severity === "moderate" || f.severity === "minor" || f.severity === "unknown"
    )
  ) {
    return "caution";
  }
  return "safe";
}
