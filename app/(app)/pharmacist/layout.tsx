"use client";

import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";

/**
 * Defense-in-depth, not the real enforcement (that's RLS —
 * prescriptions_update_institution_pharmacist / pharmacist_actions_insert_pharmacist
 * / the service-role-only dispense_drug() RPC). Scoped to pharmacist alone,
 * not ["pharmacist", "admin"]: admin can already view institution-wide
 * prescriptions (prescriptions_select_institution_staff), but every write
 * path under here is pharmacist-only at the RLS layer too, so including
 * admin would just recreate the exact "sees action buttons that silently
 * fail" problem this guard exists to close for prescribers.
 */
export default function PharmacistLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowedRoles={["pharmacist"]}>{children}</RoleGuard>;
}
