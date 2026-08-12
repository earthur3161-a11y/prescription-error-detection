import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-muted", className)}
      aria-hidden="true"
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/12 to-transparent" />
    </div>
  );
}

/**
 * Shape-matched compositions of the primitive above — a loading state
 * should visibly anticipate the content it's about to become, not just
 * mark "something's loading" with an arbitrary gray box. Named after the
 * real layout each one mirrors; extend this set rather than reaching for
 * a bare `<Skeleton className="h-16 w-full" />` when a shape below fits.
 */

/** A name/label row with a right-aligned badge-shaped chip — settings' Users list, superadmin's account/activity lists, any Badge-terminated list row. */
export function ListRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** A KPI/stat card — label line over a large number, matching dashboard/analytics/reports StatCard shapes. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-3 h-8 w-16" />
    </div>
  );
}

/** Mirrors FindingsPanel.tsx: a one-line category summary, then 2-3 collapsible flag-group headers (severity icon + label + count chip, chevron at the end). */
export function FindingsPanelSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="size-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
