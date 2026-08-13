// Unified Audit & Compliance model.
//
// The system records safety activity in four separate append-only stores —
// prescription screenings, patient self-checks, override logs, and
// pharmacist actions. Each is the source of truth for its own surface, but
// compliance oversight needs them as ONE stream: "every check and decision
// permanently recorded." This module normalises all four into a single
// `AuditEvent[]`, purely and testably, so the page stays thin.

import type { Drug, OverrideLog, PatientCheck, PharmacistAction, Prescription } from "../types";
import type { Verdict } from "../screening-engine/types";

/** Which of the three independent operations the event originated from. */
export type AuditChannel = "patient" | "pharmacy" | "physician" | "system";

/** The diagram's three record kinds: a screening check, a raised alert, or a human decision. */
export type AuditCategory = "check" | "alert" | "decision";

export type AuditTone = "safe" | "caution" | "blocked" | "info" | "neutral";

export interface AuditEvent {
  id: string;
  timestamp: string;
  channel: AuditChannel;
  category: AuditCategory;
  /** Short action label, e.g. "Prescription screened", "Override logged". */
  action: string;
  /** Resolved human name of who/what performed it. */
  actor: string;
  /** Patient + drug context, when known. */
  subject?: string;
  /** One-line human detail. */
  detail?: string;
  tone: AuditTone;
  /** Links the event back to its prescription, for the "view" affordance. */
  prescriptionId?: string;
}

export const CHANNEL_LABEL: Record<AuditChannel, string> = {
  patient: "Patient",
  pharmacy: "Pharmacy",
  physician: "Physician",
  system: "System",
};

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  check: "Check",
  alert: "Alert",
  decision: "Decision",
};

const PHARMACIST_ACTION_LABEL: Record<PharmacistAction["action"], string> = {
  approve: "Prescription approved",
  dispense: "Medication dispensed",
  reject: "Prescription rejected",
  hold: "Prescription held",
  request_clarification: "Clarification requested",
  record_intervention: "Intervention recorded",
  prescriber_response: "Prescriber responded",
};

const PHARMACIST_ACTION_TONE: Record<PharmacistAction["action"], AuditTone> = {
  approve: "safe",
  dispense: "safe",
  reject: "blocked",
  hold: "caution",
  request_clarification: "caution",
  record_intervention: "info",
  prescriber_response: "info",
};

const OVERRIDE_REASON_LABEL: Record<string, string> = {
  benefit_outweighs_risk: "Benefit outweighs risk",
  verified_with_pharmacist: "Verified with pharmacist",
  patient_tolerates_combination: "Patient tolerates combination",
  other: "Other",
};

function toneFromVerdict(verdict: Verdict): AuditTone {
  return verdict === "blocked" ? "blocked" : verdict === "caution" ? "caution" : "safe";
}

/** The most severe verdict across a prescription's screened lines. */
function worstVerdict(verdicts: { verdict: Verdict }[]): Verdict {
  if (verdicts.some((v) => v.verdict === "blocked")) return "blocked";
  if (verdicts.some((v) => v.verdict === "caution")) return "caution";
  return "safe";
}

function channelFromSource(source: Prescription["source"]): AuditChannel {
  if (source === "patient_submitted") return "patient";
  if (source === "walk_in") return "pharmacy";
  return "physician";
}

export interface AuditSources {
  prescriptions: Prescription[];
  patientChecks: PatientCheck[];
  overrideLogs: OverrideLog[];
  pharmacistActions: PharmacistAction[];
}

export interface AuditLookups {
  patients: { id: string; name: string }[];
  drugs: Drug[];
  users: { id: string; name: string }[];
  /** Resolves the currently-signed-in account id to a friendly name ("You"). */
  currentUserId?: string;
}

/**
 * Normalises every source into a single, reverse-chronological audit stream.
 * Pure — given the same inputs it always returns the same events, so it can be
 * unit-tested without a DB.
 */
export function buildAuditEvents(sources: AuditSources, lookups: AuditLookups): AuditEvent[] {
  const patientName = new Map(lookups.patients.map((p) => [p.id, p.name]));
  const drugName = new Map(lookups.drugs.map((d) => [d.id, d.generic_name]));
  const userName = new Map(lookups.users.map((u) => [u.id, u.name]));
  const rxById = new Map(sources.prescriptions.map((rx) => [rx.id, rx]));

  const resolveActor = (id?: string): string => {
    if (!id) return "System";
    if (lookups.currentUserId && id === lookups.currentUserId) return "You";
    return userName.get(id) ?? "Staff member";
  };
  const patientFor = (id?: string) => (id ? patientName.get(id) ?? "Unknown patient" : undefined);
  const rxSubject = (rx?: Prescription) => {
    if (!rx) return undefined;
    const who = patientFor(rx.patientId) ?? "Unknown patient";
    const drugs =
      rx.drugs.length === 1
        ? drugName.get(rx.drugs[0].drugId) ?? "1 drug"
        : `${rx.drugs.length} drugs`;
    return `${who} · ${drugs}`;
  };

  const events: AuditEvent[] = [];

  // 1. Prescription screenings — one "check" per prescription.
  for (const rx of sources.prescriptions) {
    const verdict = worstVerdict(rx.verdicts);
    const flagCount = rx.verdicts.reduce((n, v) => n + v.flags.length, 0);
    events.push({
      id: `check:${rx.id}`,
      timestamp: rx.createdAt,
      channel: channelFromSource(rx.source),
      category: "check",
      action: "Prescription screened",
      actor: rx.externalPrescriberName ?? resolveActor(rx.prescriberId),
      subject: rxSubject(rx),
      detail:
        verdict === "safe"
          ? "No safety flags raised."
          : `${flagCount} flag${flagCount === 1 ? "" : "s"} raised — verdict ${verdict}.`,
      tone: toneFromVerdict(verdict),
      prescriptionId: rx.id,
    });
  }

  // 2. Patient self-checks — the patient channel's "check". Self-checks
  // carry no institution_id at all (Patient Self-Check is the sole
  // no-institution exception), so an un-pulled one isn't this institution's
  // business yet; only surface it once it's been pulled into a real
  // prescription, matching the same exclusion rule the reporting module
  // (0019_reporting_module.sql) already applies. Without this, every
  // institution's admin sees every other institution's self-check activity
  // mixed into their own feed.
  for (const check of sources.patientChecks) {
    if (check.pulledIntoPrescriptionId == null) continue;
    const verdict = worstVerdict(check.verdicts);
    events.push({
      id: `check:${check.id}`,
      timestamp: check.createdAt,
      channel: "patient",
      category: "check",
      action: "Self-check screened",
      actor: "Patient (self-check)",
      subject: `${check.drugs.length} medicine${check.drugs.length === 1 ? "" : "s"}`,
      detail: "Later pulled into a pharmacy prescription.",
      tone: toneFromVerdict(verdict),
      prescriptionId: check.pulledIntoPrescriptionId,
    });
  }

  // Override logs — a prescriber/pharmacist "decision" to proceed past a flag.
  for (const log of sources.overrideLogs) {
    const rx = rxById.get(log.prescriptionId);
    events.push({
      id: `override:${log.id}`,
      timestamp: log.timestamp,
      channel: rx ? channelFromSource(rx.source) : "system",
      category: "decision",
      action: `Override logged (${log.verdictOverridden})`,
      actor: resolveActor(log.userId),
      subject: `${patientFor(rx?.patientId) ?? "Unknown patient"} · ${drugName.get(log.drugId) ?? log.drugId}`,
      detail: `${OVERRIDE_REASON_LABEL[log.reasonCode] ?? log.reasonCode}${log.reasonText ? ` — ${log.reasonText}` : ""}`,
      tone: log.verdictOverridden === "blocked" ? "blocked" : "caution",
      prescriptionId: log.prescriptionId,
    });
  }

  // Pharmacist actions — the pharmacy channel's dispensing "decision".
  for (const action of sources.pharmacistActions) {
    const rx = rxById.get(action.prescriptionId);
    const extra =
      action.interventionOutcome ??
      (action.clarificationDrugId ? drugName.get(action.clarificationDrugId) : undefined);
    events.push({
      id: `pact:${action.id}`,
      timestamp: action.timestamp,
      channel: "pharmacy",
      category: "decision",
      action: PHARMACIST_ACTION_LABEL[action.action],
      actor: resolveActor(action.pharmacistId),
      subject: rxSubject(rx) ?? patientFor(rx?.patientId),
      detail: [action.reason, extra].filter(Boolean).join(" · ") || undefined,
      tone: PHARMACIST_ACTION_TONE[action.action],
      prescriptionId: action.prescriptionId,
    });
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface AuditFilters {
  channel: AuditChannel | "all";
  category: AuditCategory | "all";
  /** Case-insensitive match across actor / subject / action / detail. */
  query: string;
}

export function filterAuditEvents(events: AuditEvent[], filters: AuditFilters): AuditEvent[] {
  const q = filters.query.trim().toLowerCase();
  return events.filter((e) => {
    if (filters.channel !== "all" && e.channel !== filters.channel) return false;
    if (filters.category !== "all" && e.category !== filters.category) return false;
    if (q) {
      const hay = `${e.action} ${e.actor} ${e.subject ?? ""} ${e.detail ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function auditEventsToCsv(events: AuditEvent[]): string[][] {
  return [
    ["Timestamp", "Channel", "Category", "Action", "Actor", "Subject", "Detail", "Tone"],
    ...events.map((e) => [
      e.timestamp,
      CHANNEL_LABEL[e.channel],
      CATEGORY_LABEL[e.category],
      e.action,
      e.actor,
      e.subject ?? "",
      e.detail ?? "",
      e.tone,
    ]),
  ];
}
