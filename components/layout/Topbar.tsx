"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu, WifiOff } from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { useIsOffline } from "@/lib/hooks/useIsOffline";
import { usePendingOutbox } from "@/lib/query/hooks/useOutbox";
import { Badge } from "@/components/ui/Badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface TopbarProps {
  onMenuClick: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const isOffline = useIsOffline();
  const { data: pending } = usePendingOutbox();

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:hidden"
        >
          <Menu className="size-5" />
        </button>
        {isOffline && (
          <span className="flex items-center gap-1.5 rounded-full bg-caution-bg px-3 py-1 text-xs font-medium text-caution-fg">
            <WifiOff className="size-3.5" aria-hidden="true" />
            Offline mode{pending && pending.length > 0 ? ` — ${pending.length} pending sync` : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {user && role && (
          <div className="text-right">
            <p className="max-w-[7rem] truncate text-sm font-medium text-foreground sm:max-w-none">
              {user.name}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">{ROLE_LABELS[role]}</p>
          </div>
        )}
        {user && (
          <Badge tone="brand" className="hidden sm:inline-flex">
            {user.title}
          </Badge>
        )}
        <ThemeToggle />
        <button
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          aria-label="Sign out"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-border text-secondary transition-all duration-200 hover:border-border-strong hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </header>
  );
}
