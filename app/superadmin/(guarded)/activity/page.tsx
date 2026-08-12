"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, Info, ShieldCheck, XCircle, type LucideIcon } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Notice } from "@/components/ui/Notice";
import { useSuperAdminActivity } from "@/lib/query/hooks/useSuperAdminActivity";
import { TONE_TEXT_CLASS } from "@/lib/design/verdictVisuals";
import {
  CATEGORY_LABEL,
  filterSuperadminActivity,
  type SuperadminActivityCategory,
  type SuperadminActivityEvent,
} from "@/lib/superadmin/activity";
import { formatDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

// Same tone→icon pairing Notice.tsx already established for these exact
// four tones — reused, not reinvented, so "neutral/safe/caution/blocked"
// means the same shape+color combination everywhere it appears, not just
// where a clinical verdict happens to be involved. A bare color dot was
// color-only, which is exactly what the design system's shape rule (see
// lib/design/verdictVisuals.ts) exists to prevent.
const TONE_ICON: Record<SuperadminActivityEvent["tone"], LucideIcon> = {
  neutral: Info,
  safe: ShieldCheck,
  caution: AlertTriangle,
  blocked: XCircle,
};

const CATEGORY_BADGE_TONE: Record<SuperadminActivityCategory, "brand" | "safe" | "caution" | "neutral"> = {
  clinical_workflow: "caution",
  patient_check: "brand",
  payment: "safe",
  account: "neutral",
  institution: "neutral",
};

function EventRow({ event }: { event: SuperadminActivityEvent }) {
  const ToneIcon = TONE_ICON[event.tone];
  return (
    <li className="flex gap-3 px-4 py-3">
      <ToneIcon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT_CLASS[event.tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">{event.action}</span>
          <Badge tone={CATEGORY_BADGE_TONE[event.category]}>{CATEGORY_LABEL[event.category]}</Badge>
        </div>
        {event.detail && <p className="mt-0.5 text-sm text-secondary">{event.detail}</p>}
        <p className="mt-1 text-xs text-subtle">
          {event.actor} · {formatDateTime(event.timestamp)}
        </p>
      </div>
    </li>
  );
}

export default function SuperAdminActivityPage() {
  const { events, isLoading, error } = useSuperAdminActivity();
  const [category, setCategory] = useState<SuperadminActivityCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(
    () =>
      filterSuperadminActivity(events, {
        category,
        query,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
      }),
    [events, category, query, from, to]
  );

  const groups = useMemo(() => {
    const byDay = new Map<string, SuperadminActivityEvent[]>();
    for (const e of filtered) {
      const day = e.timestamp.slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push(e);
      byDay.set(day, list);
    }
    return [...byDay.entries()];
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <Activity className="size-6 text-brand" aria-hidden="true" />
          Activity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every business and administrative action across all roles — never drug names, diagnoses,
          allergy details, or override reasons. Clinical detail stays governed by each role&rsquo;s own
          access controls.
        </p>
      </div>

      <Notice tone="neutral" title="Not shown here">
        Pharmacy dispense records and other pharmacist-side inventory actions are stored on-device
        (browser-local), not in the shared database, so they can&rsquo;t appear in a system-wide feed yet.
      </Notice>

      {error && (
        <Notice tone="blocked" title="Couldn't load activity">
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        </Notice>
      )}

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as SuperadminActivityCategory | "all")}>
              <option value="all">All types</option>
              <option value="clinical_workflow">{CATEGORY_LABEL.clinical_workflow}</option>
              <option value="patient_check">{CATEGORY_LABEL.patient_check}</option>
              <option value="payment">{CATEGORY_LABEL.payment}</option>
              <option value="account">{CATEGORY_LABEL.account}</option>
              <option value="institution">{CATEGORY_LABEL.institution}</option>
            </Select>
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="min-w-[130px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="min-w-[180px] flex-[2]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Actor, action, detail…" />
          </div>
        </CardBody>
      </Card>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {events.length === 0 ? "No activity recorded yet." : "No events match these filters."}
        </p>
      )}

      {!isLoading && groups.length > 0 && (
        <div className="stagger space-y-5">
          {groups.map(([day, dayEvents]) => (
            <div key={day}>
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-subtle">
                {new Date(day + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <Card>
                <ul className="divide-y divide-border">
                  {dayEvents.map((event) => (
                    <EventRow key={event.id} event={event} />
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
