"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createQueryClient } from "@/lib/query/queryClient";
import { ensureSeeded } from "@/lib/data/db";
import { ToastViewport } from "@/components/ui/Toast";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore, type SessionUser } from "@/lib/auth/session-store";
import type { AccountRole } from "@/lib/types";

/** Builds the app's SessionUser shape from a Supabase auth user + its profile row. Null if either is missing or the account is disabled. */
async function resolveSessionUser(authUser: User | null): Promise<SessionUser | null> {
  if (!authUser) return null;
  const role = authUser.app_metadata?.role as AccountRole | undefined;
  if (!role) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, title, status")
    .eq("id", authUser.id)
    .single();
  if (!profile || profile.status === "disabled") return null;

  return {
    id: authUser.id,
    email: authUser.email ?? "",
    role,
    name: profile.name,
    title: profile.title,
  };
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    ensureSeeded();

    let cancelled = false;

    // Guards against a real, observed race: authenticate() briefly
    // establishes a session via signInWithPassword() before deciding to
    // sign back out on a role mismatch, and onAuthStateChange fires for
    // BOTH transitions. resolveSessionUser() is async (it fetches the
    // profiles row), so the two events' resolutions can complete out of
    // order — an earlier-fired SIGNED_IN event's profile fetch resolving
    // AFTER a later-fired SIGNED_OUT event would silently overwrite the
    // correct logged-out state with the wrong-role account's own profile,
    // bypassing the "you must use your own portal" check entirely (RLS
    // still gates real data access correctly regardless, since it reads the
    // role claim straight from the JWT — but the client-side session must
    // reflect reality too). Each call captures the sequence number current
    // at fire time; a resolution only applies if no newer event has fired
    // since, so a stale response can never clobber a fresher one.
    let sequence = 0;

    // The authoritative signal that session hydration is done. Every page
    // that gates its first render on hasHydrated (the landing page,
    // RoleGuard, the login portals) depends on this firing exactly once,
    // regardless of outcome — mirrors the lesson learned from an earlier
    // zustand-persist bug: if Supabase's own session storage is ever
    // unreachable (blocked localStorage under strict privacy settings), the
    // app must render logged-out rather than hang on a permanent blank
    // screen, never leave hasHydrated stuck at false.
    function commitHydration(user: SessionUser | null, mySequence: number) {
      if (cancelled || sequence !== mySequence) return;
      useSessionStore.setState({ currentUser: user, hasHydrated: true });
    }

    const initialSequence = ++sequence;

    // Hard upper bound on how long the app can stay blank waiting for the
    // session check. Under normal conditions getSession() resolves near
    // -instantly from local state; this exists for a real, observed failure
    // mode — a slow/lossy connection can leave the underlying fetch()
    // *pending* far longer than a clean rejection would take (unlike, say, a
    // nonexistent domain, which fails fast). The earlier catch()-based
    // safety net only helps once the promise actually settles; this bounds
    // the wait even if it never does.
    const timeoutId = setTimeout(() => commitHydration(null, initialSequence), 8000);

    try {
      supabase.auth
        .getSession()
        .then(async ({ data }) => {
          const user = await resolveSessionUser(data.session?.user ?? null);
          clearTimeout(timeoutId);
          commitHydration(user, initialSequence);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          commitHydration(null, initialSequence);
        });
    } catch {
      clearTimeout(timeoutId);
      commitHydration(null, initialSequence);
    }

    // Keep the mirror in sync going forward: sign-in, sign-out, token
    // refresh, or another tab's auth change (Supabase broadcasts across
    // tabs). login()/logout() already update this optimistically; this
    // listener is the durable source of truth behind them. Also clears the
    // hydration timeout and marks hasHydrated done — receiving any event at
    // all means the client is functioning even if the original getSession()
    // call is still hanging.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const thisSequence = ++sequence;
      resolveSessionUser(session?.user ?? null).then((user) => {
        if (cancelled || sequence !== thisSequence) return;
        clearTimeout(timeoutId);
        useSessionStore.setState({ currentUser: user, hasHydrated: true });
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}
