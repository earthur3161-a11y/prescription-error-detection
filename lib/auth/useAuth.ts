"use client";

import { useSessionStore } from "./session-store";

export function useAuth() {
  const currentUser = useSessionStore((s) => s.currentUser);
  const hasHydrated = useSessionStore((s) => s.hasHydrated);
  const login = useSessionStore((s) => s.login);
  const logout = useSessionStore((s) => s.logout);

  return {
    user: currentUser,
    role: currentUser?.role ?? null,
    isAuthenticated: !!currentUser,
    hasHydrated,
    login,
    logout,
  };
}
