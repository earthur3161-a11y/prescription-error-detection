"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Cable,
  ClipboardList,
  FilePlus2,
  FileText,
  LayoutDashboard,
  Package,
  Pill,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  prescriber: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/prescriptions/new", label: "New Prescription", icon: FilePlus2 },
    { href: "/patients", label: "Patients", icon: Users },
    { href: "/prescriptions", label: "Prescription History", icon: FileText },
    { href: "/reports", label: "My Reports", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  pharmacist: [
    // Inventory leads the list — it's this role's ROLE_HOME_ROUTE (lib/auth/roles.ts),
    // same "home route goes first" convention Prescriber's Dashboard and
    // Admin's Facility Analytics already follow below.
    { href: "/pharmacist/inventory", label: "Inventory", icon: Package },
    { href: "/pharmacist/verify/new", label: "Verify Prescription", icon: FilePlus2 },
    { href: "/prescriptions", label: "Prescription History", icon: FileText },
    { href: "/pharmacist/drug-info", label: "Drug Info", icon: BookOpen },
    { href: "/pharmacist/reports", label: "Reports", icon: FileText },
    { href: "/pharmacist/error-log", label: "Error & Flag Log", icon: ShieldAlert },
    { href: "/patients", label: "Patients", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  admin: [
    { href: "/admin/analytics", label: "Facility Analytics", icon: BarChart3 },
    { href: "/admin/formulary", label: "Formulary Management", icon: ClipboardList },
    { href: "/admin/compliance", label: "Audit & Compliance", icon: ShieldCheck },
    { href: "/admin/audit-log", label: "Error Reporting Dashboard", icon: FileText },
    { href: "/admin/integration", label: "Integration", icon: Cable },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
};

interface SidebarProps {
  role: UserRole;
  /** null/undefined = independent practitioner, no institution. */
  institutionId?: string | null;
  onNavigate?: () => void;
}

const MY_FORMULARY_ITEM: NavItem = { href: "/formulary", label: "My Formulary", icon: Pill };

export function Sidebar({ role, institutionId, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  // Institution-affiliated prescriber/pharmacist share their Facility
  // Admin's formulary (app/(app)/admin/formulary/page.tsx) automatically —
  // this entry is only actionable for an independent one, who has no admin
  // of their own to manage it for them (0028_custom_drugs_institution_
  // boundary.sql).
  const isIndependentClinician = (role === "prescriber" || role === "pharmacist") && !institutionId;
  const items = isIndependentClinician
    ? [...NAV_BY_ROLE[role].slice(0, -1), MY_FORMULARY_ITEM, NAV_BY_ROLE[role].at(-1)!]
    : NAV_BY_ROLE[role];

  return (
    <nav aria-label="Main navigation" className="flex h-full flex-col bg-surface">
      <Link
        href={ROLE_HOME_ROUTE[role]}
        onClick={onNavigate}
        className="flex items-center gap-2 px-5 py-5 transition-opacity hover:opacity-80"
      >
        <ShieldCheck className="size-7 text-brand" aria-hidden="true" />
        <span className="text-lg font-semibold text-foreground">MediGuard</span>
      </Link>
      <ul className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                  active
                    ? "bg-brand-subtle text-brand"
                    : "text-secondary hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
