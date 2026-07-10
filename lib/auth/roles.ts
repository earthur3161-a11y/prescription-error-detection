import type { AccountRole, UserRole } from "../types";

export const ROLE_LABELS: Record<AccountRole, string> = {
  prescriber: "Physician",
  pharmacist: "Pharmacist",
  admin: "Facility Admin",
  superadmin: "MediGuard Super Admin",
};

export const ROLE_HOME_ROUTE: Record<AccountRole, string> = {
  prescriber: "/dashboard",
  pharmacist: "/pharmacist/queue",
  admin: "/admin/pipeline",
  superadmin: "/superadmin",
};

/** The three subscription-gated professional portals. */
export const PROFESSIONAL_ROLES: UserRole[] = ["prescriber", "pharmacist", "admin"];
