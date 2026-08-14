"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, ScrollText } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Skeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import { Kpi } from "@/components/analytics/Kpi";
import { PageShell } from "@/components/layout/PageShell";
import { useOverrideLogs } from "@/lib/query/hooks/useOverrideLogs";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { usePatientFeedbackReports } from "@/lib/query/hooks/usePatientFeedback";
import { useProfiles } from "@/lib/query/hooks/useProfiles";
import { useAuth } from "@/lib/auth/useAuth";
import { formatDateTime } from "@/lib/utils/date";
import { FLAG_TYPE_LABEL } from "@/lib/screening-engine";

const FLAG_TYPE_LABELS: Record<string, string> = FLAG_TYPE_LABEL;

const REASON_LABELS: Record<string, string> = {
  benefit_outweighs_risk: "Benefit outweighs risk",
  verified_with_pharmacist: "Verified with pharmacist",
  patient_tolerates_combination: "Patient already tolerates this combination",
  other: "Other",
};

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminAuditLogPage() {
  const { user } = useAuth();
  const [userFilter, setUserFilter] = useState<string>("all");
  const { data: logs, isLoading } = useOverrideLogs(
    userFilter === "all" ? {} : { userId: userFilter }
  );
  const { data: prescriptions, isLoading: prescriptionsLoading } = usePrescriptions();
  const { data: patients } = usePatients();
  const { data: formulary, isLoading: formularyLoading } = useFormulary();
  const statsLoading = prescriptionsLoading || formularyLoading;
  const { data: feedbackReports } = usePatientFeedbackReports();
  const { data: profiles } = useProfiles();
  // Only this institution's staff — the underlying override_logs rows are now
  // institution-scoped (0019), so listing every profile system-wide here
  // would let the filter name staff at other institutions even though
  // selecting them always returns zero rows.
  const institutionProfiles = [...(profiles?.values() ?? [])].filter(
    (p) => p.institutionId === user?.institutionId
  );

  const prescriptionById = useMemo(
    () => new Map((prescriptions ?? []).map((rx) => [rx.id, rx])),
    [prescriptions]
  );
  const patientNameById = useMemo(
    () => new Map((patients ?? []).map((p) => [p.id, p.name])),
    [patients]
  );
  const drugNameById = useMemo(
    () => new Map((formulary?.drugs ?? []).map((d) => [d.id, d.generic_name])),
    [formulary]
  );
  const userNameById = useMemo(
    () => new Map([...(profiles?.values() ?? [])].map((p) => [p.id, p.name])),
    [profiles]
  );
  const drugById = useMemo(
    () => new Map((formulary?.drugs ?? []).map((d) => [d.id, d])),
    [formulary]
  );

  const emlStats = useMemo(() => {
    const all = prescriptions ?? [];
    if (all.length === 0 || !formulary) return { percent: 0, total: 0, nonEmlCount: 0 };
    const nonEmlCount = all.filter((rx) =>
      rx.drugs.some((line) => drugById.get(line.drugId)?.onEssentialMedicinesList === false)
    ).length;
    return { percent: Math.round((nonEmlCount / all.length) * 100), total: all.length, nonEmlCount };
  }, [prescriptions, formulary, drugById]);

  const topFlagTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rx of prescriptions ?? []) {
      for (const verdict of rx.verdicts) {
        for (const flag of verdict.flags) {
          counts.set(flag.type, (counts.get(flag.type) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [prescriptions]);

  const topOverriddenDrugs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs ?? []) {
      counts.set(log.drugId, (counts.get(log.drugId) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs]);

  function handleExport() {
    if (!logs) return;
    const rows: string[][] = [
      ["Timestamp", "User", "Patient", "Drug", "Verdict Overridden", "Reason", "Detail"],
      ...logs.map((log) => [
        formatDateTime(log.timestamp),
        userNameById.get(log.userId) ?? log.userId,
        patientNameById.get(prescriptionById.get(log.prescriptionId)?.patientId ?? "") ?? "Unknown",
        drugNameById.get(log.drugId) ?? log.drugId,
        log.verdictOverridden,
        REASON_LABELS[log.reasonCode] ?? log.reasonCode,
        log.reasonText,
      ]),
    ];
    downloadCsv(rows, `mediguard-override-audit-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <PageShell maxWidth="5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <ScrollText className="size-6 text-brand" aria-hidden="true" />
            Error Reporting Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Facility-wide override audit trail, EML compliance, and flag trends. For the full
            cross-channel timeline of every check, alert and decision, see the{" "}
            <Link href="/admin/compliance" className="font-medium text-brand hover:underline">
              Audit &amp; Compliance Center
            </Link>
            .
          </p>
        </div>
        <Button variant="secondary" onClick={handleExport} disabled={!logs || logs.length === 0}>
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-3">
          <Kpi
            label="EML compliance"
            value={`${emlStats.percent}%`}
            sub={`${emlStats.nonEmlCount} of ${emlStats.total} prescriptions include a non-EML drug`}
            tone={emlStats.percent >= 80 ? "safe" : "caution"}
          />
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Most common flags</p>
              <ul className="mt-1.5 space-y-1 text-sm text-secondary">
                {topFlagTypes.length === 0 && <li className="text-subtle">No flags yet.</li>}
                {topFlagTypes.map(([type, count]) => (
                  <li key={type} className="flex justify-between">
                    <span>{FLAG_TYPE_LABELS[type] ?? type}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Most-overridden drugs</p>
              <ul className="mt-1.5 space-y-1 text-sm text-secondary">
                {topOverriddenDrugs.length === 0 && <li className="text-subtle">No overrides yet.</li>}
                {topOverriddenDrugs.map(([drugId, count]) => (
                  <li key={drugId} className="flex justify-between">
                    <span>{drugNameById.get(drugId) ?? drugId}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}

      {feedbackReports && feedbackReports.length > 0 && (
        <Card>
          <CardBody className="space-y-2">
            <h2 className="font-semibold text-foreground">Patient-reported issues</h2>
            <ul className="stagger space-y-2">
              {feedbackReports.map((report) => (
                <li key={report.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span className="text-subtle">{formatDateTime(report.createdAt)}</span>
                  <p className="text-secondary">{report.message}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Select
        value={userFilter}
        onChange={(e) => setUserFilter(e.target.value)}
        aria-label="Filter by prescriber"
        className="max-w-xs"
      >
        <option value="all">All users</option>
        {institutionProfiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && (logs?.length ?? 0) === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No overrides logged yet.</p>
      )}

      <div className="stagger space-y-3">
        {(logs ?? []).map((log) => {
          const prescription = prescriptionById.get(log.prescriptionId);
          return (
            <Card key={log.id}>
              <CardBody className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {patientNameById.get(prescription?.patientId ?? "") ?? "Unknown patient"} —{" "}
                    {drugNameById.get(log.drugId) ?? log.drugId}
                  </p>
                  <Badge tone={log.verdictOverridden === "blocked" ? "blocked" : "caution"}>
                    Overrode {log.verdictOverridden}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {userNameById.get(log.userId) ?? log.userId} · {formatDateTime(log.timestamp)}
                </p>
                <p className="text-sm text-secondary">
                  <span className="font-medium">{REASON_LABELS[log.reasonCode] ?? log.reasonCode}</span>
                  {log.reasonText ? ` — ${log.reasonText}` : ""}
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
