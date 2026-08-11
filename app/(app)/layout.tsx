"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { SubscriptionGuard } from "@/components/layout/SubscriptionGuard";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/lib/auth/useAuth";
import { PROFESSIONAL_ROLES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";

function Shell({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // The professional workspace is only for the three clinical roles; superadmin
  // (and unauthenticated) never render the app shell. RoleGuard handles redirects.
  if (!role || role === "superadmin") return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden w-64 shrink-0 border-r border-border md:block">
        <Sidebar role={role} institutionId={user?.institutionId} />
      </div>

      {/*
        Always mounted (not conditionally rendered) so both the open AND
        close transitions can actually play — conditional mounting means the
        close has zero time to animate before the DOM node disappears.
        `inert` when closed removes it from both the tab order and the
        accessibility tree in one go, so its (still-present, just
        off-screen) links can't be reached by keyboard/AT while hidden —
        conditional mounting used to make that unreachability automatic.
      */}
      <div
        className={cn("fixed inset-0 z-40 md:hidden", mobileNavOpen ? "pointer-events-auto" : "pointer-events-none")}
        inert={!mobileNavOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none",
            mobileNavOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-64 border-r border-border transition-transform duration-300 motion-reduce:transition-none",
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
            className="absolute right-3 top-3 grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
          <Sidebar role={role} institutionId={user?.institutionId} onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div key={pathname} className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={PROFESSIONAL_ROLES}>
      <SubscriptionGuard>
        <Shell>{children}</Shell>
      </SubscriptionGuard>
    </RoleGuard>
  );
}
