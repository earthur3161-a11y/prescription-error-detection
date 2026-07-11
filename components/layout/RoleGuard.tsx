"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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

  // hasHydrated waits on a real network call now (Supabase's session check),
  // not just a synchronous local read — under slow/lossy connections that
  // wait is bounded (see app/providers.tsx) but can still take a few
  // seconds, so show something rather than a bare blank screen.
  if (!hasHydrated) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
      </div>
    );
  }
  if (!isAuthenticated) return null;
  if (allowedRoles && role && !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
