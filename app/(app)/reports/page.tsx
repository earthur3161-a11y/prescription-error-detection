"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import {
  useReportingDailyTrend,
  useReportingDrugUsage,
  useReportingFlagTypes,
  useReportingSummary,
} from "@/lib/query/hooks/useReporting";
import {
  computeEmlUsageStats,
  computeReportingRates,
  toDailyPoints,
  toFlagTypeLabeledCounts,
  toTopFlaggedDrugs,
} from "@/lib/analytics/reportingMetrics";
import { BarList, CHART_COLORS, SegmentBar, StackedDailyChart } from "@/components/analytics/AnalyticsCharts";
import {
  presetToRange,
  ReportingRangeSelect,
  type ReportingRangePreset,
} from "@/components/analytics/ReportingRangeSelect";

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
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
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

/**
 * Own-scoped reporting for a prescriber (institutional or independent) — the
 * RPCs behind these hooks scope to prescriber_id = auth.uid() for this role,
 * never institution-wide, so there's no cross-prescriber comparison here by
 * construction, not just by omission from the UI.
 */
export default function MyReportsPage() {
  const [preset, setPreset] = useState<ReportingRangePreset>("30");
  const range = presetToRange(preset);

  const summary = useReportingSummary(range);
  const dailyTrend = useReportingDailyTrend(range);
  const flagTypes = useReportingFlagTypes(range);
  const drugUsage = useReportingDrugUsage(range);
  const formulary = useFormulary();

  const isLoading =
    summary.isLoading || dailyTrend.isLoading || flagTypes.isLoading || drugUsage.isLoading || formulary.isLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const s = summary.data ?? {
    totalPrescriptions: 0,
    totalLines: 0,
    safeLines: 0,
    cautionLines: 0,
    blockedLines: 0,
    overrideCount: 0,
  };
  const rates = computeReportingRates(s);
  const daily = toDailyPoints(dailyTrend.data ?? []);
  const drugs = formulary.data?.drugs ?? [];
  const emlStats = computeEmlUsageStats(drugUsage.data ?? [], drugs);
  const topFlaggedDrugs = toTopFlaggedDrugs(drugUsage.data ?? [], drugs);
  const flagTypeCounts = toFlagTypeLabeledCounts(flagTypes.data ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <BarChart3 className="size-6 text-brand" aria-hidden="true" />
            My Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your own screening volume, verdict trends and safety hotspots — never shared or
            compared against other prescribers. Excludes patient self-checks until pulled into one
            of your prescriptions.
          </p>
        </div>
        <ReportingRangeSelect value={preset} onChange={setPreset} />
      </div>

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Prescriptions" value={String(s.totalPrescriptions)} sub={`${s.totalLines} drug lines`} />
        <Kpi
          label="Flagged rate"
          value={`${Math.round(rates.flaggedRate * 100)}%`}
          sub="caution or blocked"
          tone={rates.flaggedRate > 0.5 ? "caution" : "default"}
        />
        <Kpi
          label="Override rate"
          value={`${Math.round(rates.overrideRate * 100)}%`}
          sub={`${s.overrideCount} logged`}
          tone={rates.overrideRate > 0.5 ? "blocked" : "default"}
        />
        <Kpi
          label="EML compliance"
          value={`${emlStats.percent}%`}
          sub="drug lines on-formulary"
          tone={emlStats.percent >= 80 ? "safe" : "caution"}
        />
      </div>

      <SectionCard title="Screening volume by verdict">
        <StackedDailyChart data={daily} />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Overall verdict mix">
          <SegmentBar
            segments={[
              { label: "Safe", value: s.safeLines, color: CHART_COLORS.safe },
              { label: "Caution", value: s.cautionLines, color: CHART_COLORS.caution },
              { label: "Blocked", value: s.blockedLines, color: CHART_COLORS.blocked },
            ]}
          />
        </SectionCard>

        <SectionCard title="Most common flag types">
          <BarList items={flagTypeCounts} color={CHART_COLORS.brand} />
        </SectionCard>

        <SectionCard title="Most-flagged drugs">
          <BarList items={topFlaggedDrugs} color={CHART_COLORS.blocked} />
        </SectionCard>
      </div>
    </div>
  );
}
