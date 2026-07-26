import { create } from "zustand";
import { supabase } from "../supabase/client";
import type { AccountRole } from "../types";

/** The authenticated identity held in the client session (a safe subset — no password). */
export interface SessionUser {
  id: string;
  name: string;
  role: AccountRole;
  title: string;
  email: string;
  /** null = independent practitioner (no institution). Sourced straight from the JWT app_metadata claim, never client-editable. */
  institutionId: string | null;
}

interface SessionState {
  currentUser: SessionUser | null;
  hasHydrated: boolean;
  login: (user: SessionUser) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

// Session persistence is now Supabase's own job (its client SDK keeps its
// own localStorage-backed token store with auto-refresh and cross-tab sync)
// — this store is a thin, non-persisted mirror of that state for React to
// read via useAuth(). The mirror is kept in sync from app/providers.tsx via
// supabase.auth.getSession() (initial) + onAuthStateChange() (ongoing).
// login() here is an optimistic local update (authenticate() has already
// called signInWithPassword by the time it's invoked); logout() clears the
// mirror and actually signs out of Supabase.
export const useSessionStore = create<SessionState>()((set) => ({
  currentUser: null,
  hasHydrated: false,
  login: (user) => set({ currentUser: user }),
  logout: () => {
    set({ currentUser: null });
    // Local scope: clears this browser's session immediately without
    // depending on a network round-trip to succeed. A global sign-out that
    // fails mid-flight (e.g. a network blip) can leave Supabase's own
    // client-side token store un-cleared, which would let a later
    // getSession() call silently resurrect the "signed out" session.
    void supabase.auth.signOut({ scope: "local" });
  },
  setHasHydrated: (value) => set({ hasHydrated: value }),
}));
