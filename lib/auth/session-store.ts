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
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
