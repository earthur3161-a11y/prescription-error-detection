"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/useAuth";
import { useAuditEvents } from "@/lib/query/hooks/useAuditEvents";
import {
  auditEventsToCsv,
  CATEGORY_LABEL,
  CHANNEL_LABEL,
  filterAuditEvents,
  type AuditCategory,
  type AuditChannel,
  type AuditEvent,
} from "@/lib/compliance/auditEvents";
import { formatDateTime } from "@/lib/utils/date";

const CHANNEL_TONE: Record<AuditChannel, "safe" | "caution" | "blocked" | "brand" | "neutral"> = {
  patient: "safe",
  pharmacy: "brand",
  physician: "caution",
  system: "neutral",
};

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </CardBody>
    </Card>
  );
}

function EventRow({ event }: { event: AuditEvent }) {
  return (
    <li className="flex gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className={
          "mt-1.5 size-2.5 shrink-0 rounded-full " +
          (event.tone === "blocked"
            ? "bg-blocked-fg"
            : event.tone === "caution"
              ? "bg-caution-fg"
              : event.tone === "safe"
                ? "bg-safe-fg"
                : event.tone === "info"
                  ? "bg-brand"
                  : "bg-muted-foreground")
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">{event.action}</span>
          <Badge tone={CHANNEL_TONE[event.channel]}>{CHANNEL_LABEL[event.channel]}</Badge>
          <Badge tone="neutral">{CATEGORY_LABEL[event.category]}</Badge>
          {event.prescriptionId && (
            <Link
              href={`/prescriptions/${event.prescriptionId}`}
              className="text-xs font-medium text-brand hover:underline"
            >
              View →
            </Link>
          )}
        </div>
        {event.subject && <p className="mt-0.5 truncate text-sm text-secondary">{event.subject}</p>}
        {event.detail && <p className="mt-0.5 text-sm text-muted-foreground">{event.detail}</p>}
        <p className="mt-1 text-xs text-subtle">
          {event.actor} · {formatDateTime(event.timestamp)}
        </p>
      </div>
    </li>
  );
}

export default function CompliancePage() {
  const { user } = useAuth();
  const { events, isLoading } = useAuditEvents(user?.id);

  const [channel, setChannel] = useState<AuditChannel | "all">("all");
  const [category, setCategory] = useState<AuditCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => filterAuditEvents(events, { channel, category, query }),
    [events, channel, category, query]
  );

  const counts = useMemo(
    () => ({
      checks: events.filter((e) => e.category === "check").length,
      alerts: events.filter((e) => e.category === "alert").length,
      decisions: events.filter((e) => e.category === "decision").length,
    }),
    [events]
  );

  // Group the filtered stream by calendar day for readable scanning.
  const groups = useMemo(() => {
    const byDay = new Map<string, AuditEvent[]>();
    for (const e of filtered) {
      const day = e.timestamp.slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push(e);
      byDay.set(day, list);
    }
    return [...byDay.entries()];
  }, [filtered]);

  function handleExport() {
    downloadCsv(
      auditEventsToCsv(filtered),
      `mediguard-compliance-${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <ShieldCheck className="size-6 text-brand" aria-hidden="true" />
            Audit &amp; Compliance Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every check, alert and decision across all three operations — one immutable,
            append-only record.
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport} disabled={filtered.length === 0}>
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-4">
        <StatCard label="Total events" value={events.length} hint="across all channels" />
        <StatCard label="Checks" value={counts.checks} hint="screenings run" />
        <StatCard label="Alerts" value={counts.alerts} hint="clinical alerts raised" />
        <StatCard label="Decisions" value={counts.decisions} hint="human actions logged" />
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Channel</label>
            <Select value={channel} onChange={(e) => setChannel(e.target.value as AuditChannel | "all")}>
              <option value="all">All channels</option>
              <option value="patient">{CHANNEL_LABEL.patient}</option>
              <option value="pharmacy">{CHANNEL_LABEL.pharmacy}</option>
              <option value="physician">{CHANNEL_LABEL.physician}</option>
              <option value="system">{CHANNEL_LABEL.system}</option>
            </Select>
          </div>
          <div className="min-w-[140px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as AuditCategory | "all")}>
              <option value="all">All types</option>
              <option value="check">{CATEGORY_LABEL.check}</option>
              <option value="alert">{CATEGORY_LABEL.alert}</option>
              <option value="decision">{CATEGORY_LABEL.decision}</option>
            </Select>
          </div>
          <div className="min-w-[180px] flex-[2]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Patient, drug, staff, action…"
            />
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
          {events.length === 0
            ? "No audit events recorded yet."
            : "No events match these filters."}
        </p>
      )}

      {!isLoading && groups.length > 0 && (
        <div className="space-y-5">
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
