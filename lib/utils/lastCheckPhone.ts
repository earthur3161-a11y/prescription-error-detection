"use client";

import { useSyncExternalStore } from "react";

const LAST_CHECK_PHONE_KEY = "mediguard-last-check-phone";

/**
 * Remembered purely so the public homepage can greet a returning,
 * quota-exhausted patient with "Start My Check" instead of the first-time
 * "Start my free check" (see app/page.tsx) — never used to skip sign-in
 * itself, which always re-verifies via OTP regardless of what's stored here.
 * Mirrors patientCheckRepository.ts's DEVICE_CHECK_IDS_KEY convention.
 */
export function rememberLastCheckPhone(phone: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_CHECK_PHONE_KEY, phone);
  } catch {
    /* ignore — worst case, the homepage falls back to the default "free check" copy */
  }
}

function readLastCheckPhone(): string | null {
  try {
    return window.localStorage.getItem(LAST_CHECK_PHONE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

// Nothing else ever changes this value while the homepage is open, so there
// is no real event to subscribe to — same no-op shape as
// lib/theme/useTheme.ts's own subscribeOnce/getMountedSnapshot pair, and for
// the same reason: the point isn't subscribing, it's the hydration-safe
// re-check useSyncExternalStore performs once after mount, with no
// setState-in-effect (react-hooks/set-state-in-effect) needed to get it.
function subscribe(): () => void {
  return () => {};
}

/** Hydration-safe read of the remembered phone (see rememberLastCheckPhone above). */
export function useLastCheckPhone(): string | null {
  return useSyncExternalStore(subscribe, readLastCheckPhone, getServerSnapshot);
}
