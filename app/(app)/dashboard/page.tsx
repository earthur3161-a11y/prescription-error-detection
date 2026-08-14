"use client";

import Link from "next/link";
import { FilePlus2, Users } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { Skeleton } from "@/components/ui/Skeleton";
import { Kpi } from "@/components/analytics/Kpi";
import { PageShell } from "@/components/layout/PageShell";
import { StackedDailyChart } from "@/components/analytics/AnalyticsCharts";
import { useAuth } from "@/lib/auth/useAuth";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { useReportingDailyTrend, useReportingSummary } from "@/lib/query/hooks/useReporting";
import { computeReportingRates, toDailyPoints } from "@/lib/analytics/reportingMetrics";
import { presetToRange } from "@/components/analytics/ReportingRangeSelect";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict } from "@/lib/screening-engine/overallVerdict";

const SNAPSHOT_RANGE = presetToRange("7");

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: patients, isLoading: patientsLoading } = usePatients();
  const { data: prescriptions, isLoading: rxLoading } = usePrescriptions({
    prescriberId: user?.id,
    currentOnly: true,
  });
  const summary = useReportingSummary(SNAPSHOT_RANGE);
  const dailyTrend = useReportingDailyTrend(SNAPSHOT_RANGE);

  const snapshotLoading = summary.isLoading || dailyTrend.isLoading;
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

  return (
    <PageShell maxWidth="5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Welcome back, {user?.name ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Screen a new prescription or pick up where you left off.
          </p>
        </div>
        <Link href="/prescriptions/new">
          <Button size="lg">
            <FilePlus2 className="size-5" aria-hidden="true" />
            New Prescription
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Last 7 days</h2>
          <Link href="/reports" className="text-sm font-medium text-brand hover:underline">
            View full reports
          </Link>
        </div>

        {snapshotLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <div className="stagger grid grid-cols-3 gap-3 sm:gap-4">
              <Kpi label="Prescriptions" value={String(s.totalPrescriptions)} sub={`${s.totalLines} drug lines`} />
              <Kpi
                label="Flagged rate"
                value={`${Math.round(rates.flaggedRate * 100)}%`}
                sub="caution or blocked"
                tone={rates.flaggedRate > 0.5 ? "caution" : "default"}
              />
              <Kpi
                label="Overrides"
                value={String(s.overrideCount)}
                sub={rates.overrideRate > 0 ? `${Math.round(rates.overrideRate * 100)}% of flagged` : "none logged"}
                tone={rates.overrideRate > 0.5 ? "blocked" : "default"}
              />
            </div>
            <Card>
              <CardBody>
                <StackedDailyChart data={daily} />
              </CardBody>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Recent patients</h2>
              <Link href="/patients" className="text-sm font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {patientsLoading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!patientsLoading && (
              <ul className="stagger divide-y divide-border">
                {(patients ?? []).slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/patients/${p.id}`}
                      className="flex items-center gap-3 py-2.5 text-sm text-secondary transition-colors active:bg-muted hover:text-brand"
                    >
                      <Users className="size-4 shrink-0 text-subtle" aria-hidden="true" />
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Your recent prescriptions</h2>
              <Link href="/prescriptions" className="text-sm font-medium text-brand hover:underline">
                View all
              </Link>
            </div>
            {rxLoading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {!rxLoading && (prescriptions?.length ?? 0) === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No prescriptions yet.</p>
            )}
            {!rxLoading && (
              <ul className="stagger divide-y divide-border">
                {(prescriptions ?? []).slice(0, 5).map((rx) => (
                  <li key={rx.id}>
                    <Link
                      href={`/prescriptions/${rx.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm text-secondary transition-colors active:bg-muted hover:text-brand"
                    >
                      <span>{formatDateTime(rx.createdAt)}</span>
                      <VerdictMark
                        verdict={overallVerdict(rx.verdicts)}
                        flags={rx.verdicts.flatMap((v) => v.flags)}
                        size="chip"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </PageShell>
  );
}
