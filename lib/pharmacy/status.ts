import type { PrescriptionStatus } from "../types";

export type PharmacyState = "new" | "under_review" | "held" | "cleared" | "dispensed" | "rejected";

/** Maps the shared prescription status to the pharmacy counter's own state vocabulary. */
export function pharmacyStateOf(status: PrescriptionStatus): PharmacyState | null {
  switch (status) {
    case "submitted":
      return "new";
    case "under_review":
      return "under_review";
    case "held":
    case "flagged":
      return "held";
    case "cleared":
    case "verified":
      return "cleared";
    case "dispensed":
      return "dispensed";
    case "rejected":
      return "rejected";
    default:
      return null; // draft / pending_admin_* — not on the pharmacy counter
  }
}

type Tone = "neutral" | "brand" | "safe" | "caution" | "blocked";

export const PHARMACY_STATE_META: Record<PharmacyState, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "brand" },
  under_review: { label: "Under Review", tone: "caution" },
  held: { label: "Held", tone: "caution" },
  cleared: { label: "Cleared", tone: "safe" },
  dispensed: { label: "Dispensed", tone: "safe" },
  rejected: { label: "Rejected", tone: "blocked" },
};

/** States still needing attention at the counter (vs. finished dispensed/rejected). */
export const ACTIVE_QUEUE_STATES: PharmacyState[] = ["new", "under_review", "held", "cleared"];
