"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "mediguard-theme";

function readTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

function getServerTheme(): Theme {
  return "light";
}

// This hook is the only thing that ever changes data-theme (via setTheme
// below) — there's no independent external event to listen for, so this is
// a real, minimal store: subscribers are notified explicitly by setTheme,
// not by some outside system pushing changes on its own.
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

// "Has the client corrected itself past the server snapshot yet" — same
// question `mounted` always answered, now derived the same way `theme` is
// rather than tracked with its own effect+setState. No subscribe needed:
// useSyncExternalStore's own contract already re-checks getSnapshot once
// after hydration settles, which is the one and only transition this needs.
function subscribeOnce(): () => void {
  return () => {};
}
const getMountedSnapshot = () => true;
const getMountedServerSnapshot = () => false;

/**
 * Reads/sets the app theme. The actual first-paint value is applied by the
 * inline script in the root layout (no FOUC) — useSyncExternalStore is what
 * lets React pick up that real, already-applied value without a hydration
 * mismatch: the server snapshot below is used for the first client render
 * (matching what the server actually rendered), then React automatically
 * re-checks and corrects to the real client value once hydration settles,
 * with no manual effect+setState needed to get there.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, getServerTheme);
  const mounted = useSyncExternalStore(subscribeOnce, getMountedSnapshot, getMountedServerSnapshot);

  function setTheme(next: Theme) {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable — the attribute change still applies for this session */
    }
    notify();
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, setTheme, toggle, mounted };
}
