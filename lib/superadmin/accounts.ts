// Super Admin account directory — normalises the 4 account types (Physician,
// Pharmacy, Facility Admin, Patient self-check) into one list. Account
// metadata only: name/contact/role/institution/status/created date, plus one
// light business-status enrichment (subscription state / free-check usage)
// since that's what makes "status" actually mean something at a glance for a
// system-of-record view. No clinical data anywhere in this module.

import type {
  SelfCheckAccountRow,
  SubscriptionRow,
  SuperadminAccountRow,
} from "../supabase/types";

export type SuperadminAccountRole = "prescriber" | "pharmacist" | "admin" | "patient";

export const SUPERADMIN_ROLE_LABEL: Record<SuperadminAccountRole, string> = {
  prescriber: "Physician",
  pharmacist: "Pharmacist",
  admin: "Facility Admin",
  patient: "Patient (self-check)",
};

export interface SuperadminAccount {
  id: string;
  role: SuperadminAccountRole;
  name: string;
  /** Email for staff accounts, phone number for patient self-check accounts. */
  contact: string;
  status: string;
  statusTone: "safe" | "caution" | "blocked" | "neutral";
  institution?: string;
  createdAt: string;
  /** One-line business-status enrichment — subscription plan, or free-check usage. Never clinical. */
  detail?: string;
}

const PRODUCT_LABEL: Record<SubscriptionRow["product"], string> = {
  physician_portal: "Physician Portal",
  pharmacy_portal: "Pharmacy Portal",
};

function subscriptionDetail(subs: SubscriptionRow[], ownerId: string, product: SubscriptionRow["product"]): string | undefined {
  const sub = subs.find((s) => s.owner_id === ownerId && s.product === product);
  if (!sub) return `${PRODUCT_LABEL[product]}: no subscription`;
  return `${PRODUCT_LABEL[product]}: ${sub.status}`;
}

export interface BuildAccountsSources {
  staff: SuperadminAccountRow[];
  selfCheckAccounts: SelfCheckAccountRow[];
  subscriptions: SubscriptionRow[];
}

export function buildSuperadminAccounts(sources: BuildAccountsSources): SuperadminAccount[] {
  const staffAccounts: SuperadminAccount[] = sources.staff
    .filter((row): row is SuperadminAccountRow & { role: SuperadminAccountRole } => row.role !== "superadmin")
    .map((row) => ({
      id: row.id,
      role: row.role,
      name: row.name,
      contact: row.email ?? "—",
      status: row.status === "active" ? "Active" : "Disabled",
      statusTone: row.status === "active" ? "safe" : "blocked",
      institution: row.institution ?? undefined,
      createdAt: row.created_at,
      detail:
        row.role === "prescriber"
          ? subscriptionDetail(sources.subscriptions, row.id, "physician_portal")
          : row.role === "pharmacist"
            ? subscriptionDetail(sources.subscriptions, row.id, "pharmacy_portal")
            : undefined,
    }));

  const patientAccounts: SuperadminAccount[] = sources.selfCheckAccounts.map((row) => ({
    id: row.id,
    role: "patient",
    name: row.phone,
    contact: row.phone,
    status: row.phone_verified ? "Verified" : "Unverified",
    statusTone: row.phone_verified ? "safe" : "caution",
    createdAt: row.created_at,
    detail: `${row.free_checks_used} free check${row.free_checks_used === 1 ? "" : "s"} used`,
  }));

  return [...staffAccounts, ...patientAccounts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface AccountFilters {
  role: SuperadminAccountRole | "all";
  query: string;
}

export function filterSuperadminAccounts(accounts: SuperadminAccount[], filters: AccountFilters): SuperadminAccount[] {
  const q = filters.query.trim().toLowerCase();
  return accounts.filter((a) => {
    if (filters.role !== "all" && a.role !== filters.role) return false;
    if (q) {
      const hay = `${a.name} ${a.contact} ${a.institution ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
