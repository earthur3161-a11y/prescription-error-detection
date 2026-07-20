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
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
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
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  pharmacist: [
    { href: "/pharmacist/verify/new", label: "Verify Prescription", icon: FilePlus2 },
    { href: "/prescriptions", label: "Prescription History", icon: FileText },
    { href: "/pharmacist/inventory", label: "Inventory", icon: Package },
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
  onNavigate?: () => void;
}

export function Sidebar({ role, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];

  return (
    <nav aria-label="Main navigation" className="flex h-full flex-col bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <ShieldCheck className="size-7 text-brand" aria-hidden="true" />
        <span className="text-lg font-semibold text-foreground">MediGuard</span>
      </div>
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
