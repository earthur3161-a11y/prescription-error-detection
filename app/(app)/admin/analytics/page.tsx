"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import {
  useReportingDailyTrend,
  useReportingDrugUsage,
  useReportingFlagTypes,
  useReportingPrescriberPerformance,
  useReportingSummary,
} from "@/lib/query/hooks/useReporting";
import {
  computeEmlUsageStats,
  computeReportingRates,
  toDailyPoints,
  toFlagTypeLabeledCounts,
  toTopFlaggedDrugs,
} from "@/lib/analytics/reportingMetrics";
import {
  BarList,
  CHART_COLORS,
  SegmentBar,
  StackedDailyChart,
} from "@/components/analytics/AnalyticsCharts";
import { Kpi } from "@/components/analytics/Kpi";
import {
  presetToRange,
  ReportingRangeSelect,
  type ReportingRangePreset,
} from "@/components/analytics/ReportingRangeSelect";

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
  const [preset, setPreset] = useState<ReportingRangePreset>("30");
  const range = presetToRange(preset);

  const summary = useReportingSummary(range);
  const dailyTrend = useReportingDailyTrend(range);
  const flagTypes = useReportingFlagTypes(range);
  const drugUsage = useReportingDrugUsage(range);
  const prescriberPerformance = useReportingPrescriberPerformance(range);
  const formulary = useFormulary();

  const isLoading =
    summary.isLoading ||
    dailyTrend.isLoading ||
    flagTypes.isLoading ||
    drugUsage.isLoading ||
    prescriberPerformance.isLoading ||
    formulary.isLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
  const prescribers = prescriberPerformance.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <BarChart3 className="size-6 text-brand" aria-hidden="true" />
            Facility Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prescription screening volume, verdict trends, safety hotspots and prescriber
            performance across the facility. Built from the same immutable record as the{" "}
            <Link href="/admin/compliance" className="font-medium text-brand hover:underline">
              Compliance Center
            </Link>
            . Excludes patient self-checks (no institution until pulled into a prescription) and
            pharmacist inventory actions (browser-local, not yet server-tracked).
          </p>
        </div>
        <ReportingRangeSelect value={preset} onChange={setPreset} />
      </div>

      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

      <SectionCard title="Prescriber performance">
        {prescribers.length === 0 ? (
          <p className="text-sm text-subtle">No prescribing activity in this range yet.</p>
        ) : (
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-subtle">
                    <th className="sticky left-0 bg-surface py-1.5 pr-4 text-left">Prescriber</th>
                    <th className="py-1.5 px-3 text-right">Lines</th>
                    <th className="py-1.5 px-3 text-right">Flag rate</th>
                    <th className="py-1.5 pl-3 text-right">Override rate</th>
                  </tr>
                </thead>
                <tbody>
                  {prescribers.map((p) => {
                    const flagRate = p.totalLines === 0 ? 0 : p.flaggedLines / p.totalLines;
                    const overrideRate = p.flaggedLines === 0 ? 0 : Math.min(1, p.overrideCount / p.flaggedLines);
                    return (
                      <tr key={p.prescriberId} className="border-b border-border last:border-0">
                        <td className="sticky left-0 bg-surface py-1.5 pr-4 font-medium text-foreground">{p.prescriberName}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-secondary">{p.totalLines}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-secondary">
                          {Math.round(flagRate * 100)}%
                          <span className="text-subtle"> ({p.flaggedLines})</span>
                        </td>
                        <td className="py-1.5 pl-3 text-right tabular-nums text-secondary">
                          {Math.round(overrideRate * 100)}%
                          <span className="text-subtle"> ({p.overrideCount})</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent md:hidden"
              aria-hidden="true"
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
