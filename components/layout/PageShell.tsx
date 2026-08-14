import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type PageShellMaxWidth = "2xl" | "3xl" | "4xl" | "5xl";

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: PageShellMaxWidth;
}

const MAX_WIDTH_CLASS: Record<PageShellMaxWidth, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

/**
 * The page-shell className string every app/(app)/ page repeats
 * (`mx-auto max-w-* space-y-* p-6 sm:p-8`), consolidated so the pattern is
 * declared once instead of copy-pasted with drift. `maxWidth` covers the
 * genuine per-page variance (list/dashboard pages run wider than detail/
 * form pages); anything else — a different space-y step, an extra utility
 * like `stagger`, a one-off `text-center` state — goes through `className`,
 * which wins over these defaults via cn()'s twMerge.
 *
 * Scoped to app/(app)/ only. Superadmin has its own layout with its own
 * baked-in max-w-5xl `<main>`; the pre-auth journey, Patient Self-Check,
 * and the homepage are each already deliberately different "rooms" (see
 * the gradient-scoping comment in globals.css) with their own container
 * conventions — folding them into this would blur a distinction the
 * codebase already draws on purpose, not fix an inconsistency.
 */
export function PageShell({ maxWidth = "3xl", className, ...props }: PageShellProps) {
  return (
    <div
      className={cn("mx-auto", MAX_WIDTH_CLASS[maxWidth], "space-y-6 p-6 sm:p-8", className)}
      {...props}
    />
  );
}
