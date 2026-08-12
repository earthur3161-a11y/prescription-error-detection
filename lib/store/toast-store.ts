import { create } from "zustand";

export type ToastVariant = "default" | "success" | "warning" | "error";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** True for the exit animation's duration, then the toast is actually removed. See EXIT_MS in Toast.tsx's motion tier — kept in sync manually since CSS custom properties aren't readable from TS. */
  leaving?: boolean;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

// Matches --animate-fade-out's 150ms (app/globals.css) — the toast's own
// exit class duration. Dismissal (manual click or the 4500ms auto-timeout
// below) always goes through this two-step path so an unmount is never a
// hard cut: mark leaving, let the exit animation play, then actually drop
// the toast from the array.
const EXIT_MS = 150;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => get().dismiss(id), 4500);
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, EXIT_MS);
  },
}));
