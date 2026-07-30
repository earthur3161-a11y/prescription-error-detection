import type { Verdict } from "../screening-engine";
import type { VerdictBasis } from "../design/verdictVisuals";

export interface PatientGuidance {
  headline: string;
  detail: string;
  steps: string[];
  /**
   * Plain-language explanation of *why* this isn't a confirmed finding, for
   * a caution/blocked result driven wholly or partly by missing information
   * rather than something actually found wrong. Undefined when the result
   * is fully confirmed (including every "safe" result) — there's nothing to
   * explain away there. Kept separate from `detail` deliberately: this is a
   * distinct idea ("we don't know yet" vs. "we found something"), and
   * folding it into one paragraph risks a patient skimming past the exact
   * distinction the shape/color on screen is trying to carry.
   */
  basisNote?: string;
}

/**
 * Plain-language, non-alarming guidance shown for every verdict. Caution and
 * Blocked results must always route the patient to a professional — never
 * tell them to simply stop or ignore a prescription themselves.
 *
 * `basis` defaults to "confirmed" for callers that haven't computed it —
 * every verdict still gets correct, safe guidance either way; only the
 * `basisNote` explainer depends on it.
 */
export function getPatientGuidance(verdict: Verdict, basis: VerdictBasis = "confirmed"): PatientGuidance {
  switch (verdict) {
    case "safe":
      return {
        headline: "This looks safe based on what you told us.",
        detail: "We didn't find any allergy conflicts, interactions, or dosing concerns in what this tool checks for — it doesn't catch everything, so it's still worth mentioning to your pharmacist.",
        steps: [
          "Take it as directed on the label or by your doctor.",
          "If anything feels wrong after taking it, contact your pharmacist or doctor.",
        ],
      };
    case "caution":
      return {
        headline: "Worth double-checking with your pharmacist.",
        detail: "We found something that's usually manageable, but a professional should confirm it's okay for you.",
        steps: [
          "Show this result to your pharmacist before taking it, if you haven't already.",
          "They can tell you whether any adjustment or monitoring is needed.",
          "Don't stop or change your other medicines without talking to a professional first.",
        ],
        basisNote:
          basis === "unknown-only"
            ? "Nothing to be alarmed about — we didn't actually find a problem here. We just don't have enough information about you yet (like your age, weight, or kidney health) to be fully sure, and we'd rather say so honestly than guess. That's different from finding something wrong, and your pharmacist can usually clear it up in a minute."
            : basis === "mixed"
              ? "This result is two things at once: something we did find, explained below, and something we couldn't check because we're missing a bit of information about you. Both matter, but they're not the same kind of concern."
              : undefined,
      };
    case "blocked":
      return {
        headline: "Please talk to your pharmacist or doctor before taking this.",
        detail: "We found something serious enough that a professional should review it with you first.",
        steps: [
          "Show this result to your pharmacist or call your doctor's office before taking it.",
          "Keep the medication in its packaging in case they need to see it.",
          "If you're already feeling unwell, seek medical care right away.",
        ],
        // A blocked result always includes at least one real, confirmed
        // finding — missing information alone never leads here — so the
        // note only ever needs to acknowledge a *mixed* case, not explain
        // the whole result away as unverified the way caution's can.
        basisNote:
          basis === "mixed"
            ? "Part of this result is something we actually found; part of it is information we're missing about you. Either one on its own would be reason enough to talk to a professional first — this isn't a case where clearing up the missing information would change the advice."
            : undefined,
      };
  }
}
