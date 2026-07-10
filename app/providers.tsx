"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { createQueryClient } from "@/lib/query/queryClient";
import { ensureSeeded } from "@/lib/data/db";
import { ToastViewport } from "@/components/ui/Toast";
import { useSessionStore } from "@/lib/auth/session-store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    ensureSeeded();

    // The authoritative signal that session hydration is done — see the
    // comment above useSessionStore's definition for why this can't
    // reliably live inside persist's onRehydrateStorage callback instead.
    // By the time this effect runs, the store has already finished its one
    // synchronous initialization pass (success, storage error, or storage
    // entirely unavailable), so this update always sticks. Every page that
    // gates its first render on hasHydrated (the landing page, RoleGuard,
    // the login portals) depends on this firing exactly once, unconditionally.
    useSessionStore.getState().setHasHydrated(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}
