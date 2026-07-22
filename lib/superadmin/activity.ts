// Super Admin unified activity feed — normalises every business/
// administrative event in the system into one reverse-chronological stream.
//
// Deliberately separate from lib/compliance/auditEvents.ts, which is full of
// clinical detail (drug names, override reasons) by design for its audience
// (compliance staff investigating a specific safety incident). This module
// is the opposite: every source here is either already non-clinical (a
// payment, an account, an institution) or has had its clinical columns
// stripped out at the database layer before it ever reaches the client — see
// the superadmin RPCs in supabase/migrations/0009_superadmin_oversight.sql.
// No amount of client-side filtering here can "leak" clinical content,
// because that content was never selected out of Postgres in the first
// place.
//
// KNOWN GAP, TRACKED FOLLOW-UP (not fixed here): pharmacy dispense records,
// stock adjustments, and other pharmacist-side inventory actions
// (dispenseRecordRepository, pharmacistActionRepository, batchRepository)
// still live entirely in per-browser Dexie/IndexedDB, never migrated to
// Supabase — see the "stays on Dexie" scoping note in
// 0002_phase2_clinical_data.sql. That means this feed structurally cannot
// see them; they're not filtered out, they were never written to a place
// this module can read from. Surfacing them here requires a migration
// moving that data server-side first — out of scope for this feature, but
// flagged so it doesn't get silently assumed to already be covered.

import type {
  CheckPaymentRow,
  InstitutionApiKeySuperadminRow,
  InstitutionRow,
  SubscriptionPaymentRow,
  SuperadminAccountRow,
  SuperadminOverrideActivityRow,
  SuperadminPatientCheckActivityRow,
  SuperadminPrescriptionActivityRow,
} from "../supabase/types";
import type { AccessRequest } from "../types";
import { SUPERADMIN_ROLE_LABEL, type SuperadminAccountRole } from "./accounts";

export type SuperadminActivityCategory =
  | "clinical_workflow" // a prescription screened, or a caution/blocked verdict overridden
  | "patient_check" // an anonymous self-check completed
  | "payment" // any money moving — self-check credit or portal subscription
  | "account" // an account provisioned, or a Facility Admin request reviewed
  | "institution"; // institution created, or an API key minted/revoked

export const CATEGORY_LABEL: Record<SuperadminActivityCategory, string> = {
  clinical_workflow: "Clinical workflow",
  patient_check: "Patient self-check",
  payment: "Payment",
  account: "Account",
  institution: "Institution",
};

export type SuperadminActivityTone = "neutral" | "safe" | "caution" | "blocked";

export interface SuperadminActivityEvent {
  id: string;
  timestamp: string;
  category: SuperadminActivityCategory;
  actorRole: SuperadminAccountRole | "superadmin" | "system";
  actor: string;
  action: string;
  detail?: string;
  tone: SuperadminActivityTone;
}

export interface ActivitySources {
  accounts: SuperadminAccountRow[];
  prescriptions: SuperadminPrescriptionActivityRow[];
  overrides: SuperadminOverrideActivityRow[];
  patientChecks: SuperadminPatientCheckActivityRow[];
  checkPayments: CheckPaymentRow[];
  subscriptionPayments: SubscriptionPaymentRow[];
  accessRequests: AccessRequest[];
  institutions: InstitutionRow[];
  apiKeys: InstitutionApiKeySuperadminRow[];
}

const PRODUCT_LABEL: Record<SubscriptionPaymentRow["product"], string> = {
  physician_portal: "Physician Portal",
  pharmacy_portal: "Pharmacy Portal",
};

function pesewasToGhs(amount: number): string {
  return `GHS ${(amount / 100).toFixed(2)}`;
}

export function buildSuperadminActivity(sources: ActivitySources): SuperadminActivityEvent[] {
  const staffById = new Map(sources.accounts.map((a) => [a.id, a]));
  const events: SuperadminActivityEvent[] = [];

  // Prescriptions screened — actor/subject names already resolved server-side.
  for (const rx of sources.prescriptions) {
    events.push({
      id: `rx:${rx.id}`,
      timestamp: rx.created_at,
      category: "clinical_workflow",
      actorRole: "prescriber",
      actor: rx.prescriber_name,
      action: `Created a prescription for ${rx.patient_name}`,
      detail: `Status: ${rx.status.replace(/_/g, " ")}`,
      tone: "neutral",
    });
  }

  // Overrides — that one happened, not what it was.
  for (const ov of sources.overrides) {
    events.push({
      id: `ov:${ov.id}`,
      timestamp: ov.timestamp,
      category: "clinical_workflow",
      actorRole: "pharmacist",
      actor: ov.user_name,
      action: `Processed an override on prescription #${ov.prescription_id.slice(0, 8)}`,
      tone: "caution",
    });
  }

  // Patient self-checks.
  for (const check of sources.patientChecks) {
    events.push({
      id: `check:${check.id}`,
      timestamp: check.created_at,
      category: "patient_check",
      actorRole: "patient",
      actor: check.phone ?? "Unknown patient",
      action: "Completed a self-check",
      detail: check.pulled_into_prescription_id
        ? "Later pulled into a pharmacy prescription."
        : undefined,
      tone: "neutral",
    });
  }

  // Self-check payments.
  for (const pay of sources.checkPayments) {
    if (pay.status !== "success") continue;
    events.push({
      id: `checkpay:${pay.id}`,
      timestamp: pay.verified_at ?? pay.created_at,
      category: "payment",
      actorRole: "patient",
      actor: pay.phone,
      action: `Paid for a self-check credit (${pesewasToGhs(pay.amount_pesewas)})`,
      tone: "safe",
    });
  }

  // Subscription payments (Physician/Pharmacy Portal).
  for (const pay of sources.subscriptionPayments) {
    if (pay.status !== "success") continue;
    const owner = staffById.get(pay.owner_id);
    events.push({
      id: `subpay:${pay.id}`,
      timestamp: pay.verified_at ?? pay.created_at,
      category: "payment",
      actorRole: owner?.role === "pharmacist" ? "pharmacist" : "prescriber",
      actor: owner?.name ?? "Unknown account",
      action: `Paid for ${PRODUCT_LABEL[pay.product]} (${pesewasToGhs(pay.amount_pesewas)})`,
      tone: "safe",
    });
  }

  // Account provisioning — every staff account's creation, physician/pharmacy
  // self-serve or Facility Admin superadmin-approved alike.
  for (const account of sources.accounts) {
    if (account.role === "superadmin") continue;
    const role = account.role as SuperadminAccountRole;
    events.push({
      id: `acct:${account.id}`,
      timestamp: account.created_at,
      category: "account",
      actorRole: role,
      actor: account.name,
      action: `${SUPERADMIN_ROLE_LABEL[role]} account created`,
      detail: account.institution ?? undefined,
      tone: "neutral",
    });
  }

  // Facility Admin access requests reviewed by a superadmin.
  for (const req of sources.accessRequests) {
    if (req.status === "pending") continue;
    events.push({
      id: `areq:${req.id}`,
      timestamp: req.reviewedAt ?? req.createdAt,
      category: "account",
      actorRole: "superadmin",
      actor: "Super Admin",
      action: req.status === "approved" ? `Approved ${req.fullName}'s access request` : `Rejected ${req.fullName}'s access request`,
      detail: `${req.institution} · requested Facility Admin`,
      tone: req.status === "approved" ? "safe" : "blocked",
    });
  }

  // Institutions created (Facility Admin approval also provisions the institution).
  for (const inst of sources.institutions) {
    events.push({
      id: `inst:${inst.id}`,
      timestamp: inst.created_at,
      category: "institution",
      actorRole: "superadmin",
      actor: "Super Admin",
      action: `Institution provisioned: ${inst.name}`,
      detail: inst.status === "suspended" ? "Currently suspended" : undefined,
      tone: inst.status === "suspended" ? "blocked" : "neutral",
    });
  }

  // API keys minted / revoked.
  for (const key of sources.apiKeys) {
    events.push({
      id: `key:${key.id}:mint`,
      timestamp: key.created_at,
      category: "institution",
      actorRole: "admin",
      actor: "Facility Admin",
      action: `${key.mode === "live" ? "Live" : "Sandbox"} API key minted`,
      detail: key.key_prefix,
      tone: "neutral",
    });
    if (key.revoked_at) {
      events.push({
        id: `key:${key.id}:revoke`,
        timestamp: key.revoked_at,
        category: "institution",
        actorRole: "admin",
        actor: "Facility Admin",
        action: `${key.mode === "live" ? "Live" : "Sandbox"} API key revoked`,
        detail: key.key_prefix,
        tone: "caution",
      });
    }
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export interface ActivityFilters {
  category: SuperadminActivityCategory | "all";
  query: string;
  from?: string;
  to?: string;
}

export function filterSuperadminActivity(events: SuperadminActivityEvent[], filters: ActivityFilters): SuperadminActivityEvent[] {
  const q = filters.query.trim().toLowerCase();
  return events.filter((e) => {
    if (filters.category !== "all" && e.category !== filters.category) return false;
    if (filters.from && e.timestamp < filters.from) return false;
    if (filters.to && e.timestamp > filters.to) return false;
    if (q) {
      const hay = `${e.action} ${e.actor} ${e.detail ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
