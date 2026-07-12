import type { Verdict } from "../screening-engine";

export interface PatientGuidance {
  headline: string;
  detail: string;
  steps: string[];
}

/**
 * Plain-language, non-alarming guidance shown for every verdict. Caution and
 * Blocked results must always route the patient to a professional — never
 * tell them to simply stop or ignore a prescription themselves.
 */
export function getPatientGuidance(verdict: Verdict): PatientGuidance {
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
      };
  }
}
