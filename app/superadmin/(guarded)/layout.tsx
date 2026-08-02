"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldAlert } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/useAuth";

const TABS = [
  { href: "/superadmin", label: "Access requests" },
  { href: "/superadmin/accounts", label: "Accounts" },
  { href: "/superadmin/activity", label: "Activity" },
];

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, hasHydrated, logout } = useAuth();

  useEffect(() => {
    if (!hasHydrated) return;
    if (role !== "superadmin") router.replace("/superadmin/login");
  }, [hasHydrated, role, router]);

  if (!hasHydrated || role !== "superadmin") {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-subtle" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href="/superadmin" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <ShieldAlert className="size-6 text-foreground" aria-hidden="true" />
            <span className="font-semibold text-foreground">MediGuard Operations</span>
          </Link>
          <button
            onClick={() => {
              logout();
              router.replace("/superadmin/login");
            }}
            aria-label="Sign out"
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
        <nav aria-label="Super Admin sections" className="flex gap-1 px-6">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-secondary hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
