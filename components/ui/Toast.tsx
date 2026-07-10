"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/lib/store/toast-store";
import { cn } from "@/lib/utils/cn";

const variantConfig: Record<ToastVariant, { icon: typeof Info; classes: string }> = {
  default: { icon: Info, classes: "bg-surface border-border text-foreground" },
  success: { icon: CheckCircle2, classes: "bg-surface border-safe-border text-foreground" },
  warning: { icon: AlertTriangle, classes: "bg-surface border-caution-border text-foreground" },
  error: { icon: XCircle, classes: "bg-surface border-blocked-border text-foreground" },
};

const iconColor: Record<ToastVariant, string> = {
  default: "text-subtle",
  success: "text-safe-fg",
  warning: "text-caution-fg",
  error: "text-blocked-fg",
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => {
        const { icon: Icon, classes } = variantConfig[toast.variant];
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-fade-up",
              classes
            )}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", iconColor[toast.variant])} aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-medium">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-muted-foreground">{toast.description}</p>
              )}
            </div>
            <button
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="text-subtle hover:text-secondary"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
