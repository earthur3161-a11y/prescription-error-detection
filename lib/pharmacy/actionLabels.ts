import type { PharmacistActionType } from "../types";

/** Human-readable label per pharmacist_actions row type — shared by the pharmacist Review page's action history and the prescriber-facing clarification section on the prescription detail page, so the same action reads identically wherever it appears. */
export const ACTION_LABEL: Record<PharmacistActionType, string> = {
  approve: "Approved",
  dispense: "Dispensed",
  reject: "Rejected",
  hold: "Held",
  request_clarification: "Requested clarification",
  record_intervention: "Recorded intervention",
  prescriber_response: "Responded",
};
