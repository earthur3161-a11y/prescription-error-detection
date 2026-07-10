"use client";

import { useSyncExternalStore } from "react";
import { useOfflineStore } from "../store/offline-store";

function subscribe(callback: () => void) {
  window.addEventListener("offline", callback);
  window.addEventListener("online", callback);
  return () => {
    window.removeEventListener("offline", callback);
    window.removeEventListener("online", callback);
  };
}

function getSnapshot() {
  return !navigator.onLine;
}

export function useIsOffline(): boolean {
  const simulateOffline = useOfflineStore((s) => s.simulateOffline);
  const browserOffline = useSyncExternalStore(subscribe, getSnapshot, () => false);

  return simulateOffline || browserOffline;
}
