"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { groupFlagsByType, summariseByCategory } from "@/lib/screening-engine";
import type { Flag } from "@/lib/screening-engine";
import { FlagSeverityChip, FlagSeverityIcon } from "@/components/ui/FlagSeverityChip";
import { SafeSeal } from "@/components/ui/shapes";

/**
 * The automated screening findings panel: a one-line category summary at
 * the top, then flags grouped by distinct type (worst first), each
 * expandable to full clinical detail (message, severity, source, suggested
 * correction lives in the text). Icon+color+label for every severity comes
 * from FlagSeverityChip/Icon (lib/design/verdictVisuals) — the single
 * source of truth every other verdict-adjacent surface in the app also
 * draws from, replacing what used to be this panel's own independent
 * severity→color map.
 */
export function FindingsPanel({ flags }: { flags: Flag[] }) {
  const groups = groupFlagsByType(flags);
  const [open, setOpen] = useState<Set<string>>(new Set(groups.map((g) => g.type)));

  if (flags.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-safe-bg px-4 py-3 text-sm text-safe-fg">
        <SafeSeal size={22} color="var(--safe-fg)" />
        No issues found against our known rules — this isn&rsquo;t a guarantee no interaction exists.
      </div>
    );
  }

  function toggle(type: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-secondary">{summariseByCategory(flags)}</p>
      <div className="space-y-2">
        {groups.map((group) => {
          const isOpen = open.has(group.type);
          return (
            <div key={group.type} className="overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => toggle(group.type)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 bg-surface-2 px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FlagSeverityIcon severity={group.maxSeverity} size={16} />
                  {group.label}
                  <span className="rounded-full bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {group.flags.length}
                  </span>
                </span>
                <ChevronDown className={cn("size-4 text-subtle transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
              </button>
              {isOpen && (
                <ul className="divide-y divide-border">
                  {group.flags.map((flag, i) => (
                    <li key={`${flag.code}-${i}`} className="space-y-1 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <FlagSeverityChip severity={flag.severity} />
                        <span className="font-mono text-xs text-subtle">{flag.code}</span>
                      </div>
                      <p className="text-sm text-secondary">{flag.message}</p>
                      {flag.referenceSource && (
                        <p className="text-xs text-subtle">Source: {flag.referenceSource}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
