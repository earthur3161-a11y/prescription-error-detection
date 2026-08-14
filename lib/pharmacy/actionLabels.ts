import {
  CheckCircle2,
  HelpCircle,
  MessageCircle,
  PackageCheck,
  PauseCircle,
  Stethoscope,
  XCircle,
  type LucideIcon,
} from "lucide-react";
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

/**
 * Icon per action type — same two call sites as ACTION_LABEL, kept next to
 * it for the same reason: one shared mapping instead of two that can drift.
 * The first six match PharmacistActionBar.tsx's own icons exactly (that's
 * where an action is initiated); prescriber_response has no bar button of
 * its own (it's logged from the prescriber's reply flow on the prescription
 * detail page) — MessageCircle answers HelpCircle's question, consistent
 * with the "X-in-a-circle" family the other six already share.
 */
export const ACTION_ICON: Record<PharmacistActionType, LucideIcon> = {
  approve: CheckCircle2,
  dispense: PackageCheck,
  reject: XCircle,
  hold: PauseCircle,
  request_clarification: HelpCircle,
  record_intervention: Stethoscope,
  prescriber_response: MessageCircle,
};
