"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";
import type { AccountRole } from "@/lib/types";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles?: AccountRole[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const router = useRouter();
  const { role, isAuthenticated, hasHydrated } = useAuth();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (allowedRoles && role && !allowedRoles.includes(role)) {
      router.replace(ROLE_HOME_ROUTE[role]);
    }
  }, [hasHydrated, isAuthenticated, role, allowedRoles, router]);

  // (superadmin falls through to ROLE_HOME_ROUTE redirect above when not in allowedRoles)

  if (!hasHydrated || !isAuthenticated) return null;
  if (allowedRoles && role && !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
