"use client";

import { BarChart3, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFacilityMetrics } from "@/lib/query/hooks/useFacilityMetrics";
import {
  BarList,
  CHART_COLORS,
  SegmentBar,
  StackedDailyChart,
} from "@/components/analytics/AnalyticsCharts";
import { formatDateTime } from "@/lib/utils/date";

function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "safe" | "caution" | "blocked";
}) {
  const valueClass =
    tone === "safe"
      ? "text-safe-fg"
      : tone === "caution"
        ? "text-caution-fg"
        : tone === "blocked"
          ? "text-blocked-fg"
          : "text-foreground";
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </CardBody>
    </Card>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <h2 className="font-semibold text-foreground">{title}</h2>
        {children}
      </CardBody>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { metrics, isLoading } = useFacilityMetrics();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const { verdictCounts } = metrics;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
          <BarChart3 className="size-6 text-brand" aria-hidden="true" />
          Facility Analytics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Screening volume, verdict trends, safety hotspots and pharmacist outcomes across the
          facility. Built from the same immutable record as the{" "}
          <Link href="/admin/compliance" className="font-medium text-brand hover:underline">
            Compliance Center
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Screenings" value={String(metrics.totalScreenings)} sub={`${metrics.totalLines} drug lines`} />
        <Kpi
          label="Flagged rate"
          value={`${Math.round(metrics.flaggedRate * 100)}%`}
          sub="caution or blocked"
          tone={metrics.flaggedRate > 0.5 ? "caution" : "default"}
        />
        <Kpi
          label="Override rate"
          value={`${Math.round(metrics.overrideRate * 100)}%`}
          sub={`${metrics.overrideCount} logged`}
          tone={metrics.overrideRate > 0.5 ? "blocked" : "default"}
        />
        <Kpi
          label="EML compliance"
          value={`${metrics.emlCompliancePct}%`}
          sub="prescriptions on-formulary"
          tone={metrics.emlCompliancePct >= 80 ? "safe" : "caution"}
        />
      </div>

      <SectionCard title="Screening volume by verdict">
        <StackedDailyChart data={metrics.daily} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Overall verdict mix">
          <SegmentBar
            segments={[
              { label: "Safe", value: verdictCounts.safe, color: CHART_COLORS.safe },
              { label: "Caution", value: verdictCounts.caution, color: CHART_COLORS.caution },
              { label: "Blocked", value: verdictCounts.blocked, color: CHART_COLORS.blocked },
            ]}
          />
          {metrics.activeAlerts > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-caution-fg">
              <TrendingUp className="size-4" aria-hidden="true" />
              {metrics.activeAlerts} clinical alert{metrics.activeAlerts === 1 ? "" : "s"} currently
              open
            </p>
          )}
        </SectionCard>

        <SectionCard title="Most common flag types">
          <BarList items={metrics.flagTypes} color={CHART_COLORS.brand} />
        </SectionCard>

        <SectionCard title="Most-flagged drugs">
          <BarList items={metrics.topFlaggedDrugs} color={CHART_COLORS.blocked} />
        </SectionCard>

        <SectionCard title="Pharmacist decisions">
          <BarList items={metrics.pharmacistActions} color={CHART_COLORS.brand} emptyLabel="No pharmacist actions logged yet." />
        </SectionCard>
      </div>

      {metrics.interventions.length > 0 && (
        <SectionCard title="Recent pharmacist interventions">
          <ul className="space-y-2">
            {metrics.interventions.slice(0, 8).map((i, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
                <span className="text-sm text-secondary">{i.outcome}</span>
                <span className="shrink-0 text-xs text-subtle">{formatDateTime(i.timestamp)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
