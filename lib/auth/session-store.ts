import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountRole } from "../types";

/** The authenticated identity held in the client session (a safe subset of Account — no password). */
export interface SessionUser {
  id: string;
  name: string;
  role: AccountRole;
  title: string;
  email: string;
}

interface SessionState {
  currentUser: SessionUser | null;
  hasHydrated: boolean;
  login: (user: SessionUser) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

// hasHydrated is deliberately NOT driven by persist's onRehydrateStorage
// option. zustand's persist middleware resolves synchronous storage (the
// default: localStorage) entirely within the initial create() call, and its
// internal `hydrate()` returns `stateFromStorage || configResult` as the
// store's final initial state — silently discarding any set() calls made
// from inside onRehydrateStorage's callback on the error path (that
// callback fires, but the resulting state update gets overwritten a moment
// later by that return value, since `stateFromStorage` is only ever
// assigned on the success path). Verified empirically against the installed
// zustand version — this is not a hypothetical. setHasHydrated is instead
// called once from a useEffect in Providers (app/providers.tsx), which runs
// strictly after the store has finished initializing, so the update always
// sticks regardless of whether storage was reachable.
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentUser: null,
      hasHydrated: false,
      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "mediguard-session",
    }
  )
);
