import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OfflineState {
  simulateOffline: boolean;
  toggleSimulateOffline: () => void;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      simulateOffline: false,
      toggleSimulateOffline: () => set((s) => ({ simulateOffline: !s.simulateOffline })),
    }),
    { name: "mediguard-offline" }
  )
);
