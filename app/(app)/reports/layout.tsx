"use client";

import type { ReactNode } from "react";
import { RoleGuard } from "@/components/layout/RoleGuard";

/**
 * Own-scoped prescriber reporting — flag/override rate for your own
 * prescriptions only, no cross-prescriber comparison table. Distinct from
 * /admin/analytics, which is the institution-wide, admin-only view with a
 * prescriber-performance comparison. Pharmacist-authored walk-in
 * prescriptions are covered by /pharmacist/reports instead (dispensing-
 * focused; out of scope here).
 */
export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <RoleGuard allowedRoles={["prescriber"]}>{children}</RoleGuard>;
}
