import type { AccountRole, UserRole } from "../types";
import type { SubscriptionProduct } from "../supabase/types";

export const ROLE_LABELS: Record<AccountRole, string> = {
  prescriber: "Physician",
  pharmacist: "Pharmacist",
  admin: "Facility Admin",
  superadmin: "MediGuard Super Admin",
};

export const ROLE_HOME_ROUTE: Record<AccountRole, string> = {
  prescriber: "/dashboard",
  pharmacist: "/pharmacist/inventory",
  admin: "/admin/analytics",
  superadmin: "/superadmin",
};

/** The three subscription-gated professional portals. */
export const PROFESSIONAL_ROLES: UserRole[] = ["prescriber", "pharmacist", "admin"];

/**
 * Independent practitioners pay for their own seat; admin/superadmin have no
 * subscription product of their own (institution-employed staff are covered
 * by their institution's contract instead — see 0022_restore_subscription_
 * enforcement.sql). Roles absent here should never be subscription-gated.
 */
export const ROLE_PRODUCT: Partial<Record<AccountRole, SubscriptionProduct>> = {
  prescriber: "physician_portal",
  pharmacist: "pharmacy_portal",
};
