"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Download, PackageCheck, PauseCircle, Stethoscope, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAllPharmacistActions, useDispenseRecords, useBatches, usePharmacySettings } from "@/lib/query/hooks/usePharmacy";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useProfiles } from "@/lib/query/hooks/useProfiles";
import { summariseStock, effectiveBatchStatus } from "@/lib/pharmacy/inventory";
import { formatDateTime } from "@/lib/utils/date";

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PharmacyReportsPage() {
  const { data: actions } = useAllPharmacistActions();
  const { data: dispenses } = useDispenseRecords();
  const { data: batches } = useBatches();
  const { data: settings } = usePharmacySettings();
  const { data: patients } = usePatients();
  const { data: formulary } = useFormulary();
  const { data: profiles } = useProfiles();

  const patientNameById = useMemo(() => new Map((patients ?? []).map((p) => [p.id, p.name])), [patients]);

  const today = useMemo(() => {
    const a = (actions ?? []).filter((x) => isToday(x.timestamp));
    const d = (dispenses ?? []).filter((x) => isToday(x.dispensedAt));
    return {
      dispensed: d.length,
      holds: a.filter((x) => x.action === "hold" || x.action === "request_clarification").length,
      rejections: a.filter((x) => x.action === "reject").length,
      interventions: a.filter((x) => x.action === "record_intervention").length,
      dispenses: d,
      interventionList: a.filter((x) => x.action === "record_intervention"),
    };
  }, [actions, dispenses]);

  const attention = useMemo(() => {
    if (!formulary || !batches || !settings) return { low: [], nearExpiry: [] as string[] };
    const summaries = summariseStock(formulary.drugs, batches, settings);
    const low = summaries.filter((s) => s.lowStock).map((s) => s.drug.generic_name);
    const nearExpiry = batches
      .filter((b) => effectiveBatchStatus(b, settings.nearExpiryDays) === "near_expiry")
      .map((b) => {
        const drug = formulary.drugs.find((d) => d.id === b.drugId);
        return `${drug?.generic_name ?? b.drugId} (${b.batchNumber}, exp ${b.expiryDate})`;
      });
    return { low, nearExpiry };
  }, [formulary, batches, settings]);

  function exportCsv() {
    const rows: string[][] = [["Type", "Detail", "Pharmacist", "When"]];
    for (const d of today.dispenses) {
      rows.push(["Dispensed", `${d.drugName} ×${d.quantityDispensed} → ${patientNameById.get(d.patientId) ?? d.patientId}`, profiles?.get(d.pharmacistId)?.name ?? d.pharmacistId, formatDateTime(d.dispensedAt)]);
    }
    for (const a of today.interventionList) {
      rows.push(["Intervention", `${a.reason ?? ""}${a.interventionOutcome ? " → " + a.interventionOutcome : ""}`, profiles?.get(a.pharmacistId)?.name ?? a.pharmacistId, formatDateTime(a.timestamp)]);
    }
    downloadCsv(rows, `mediguard-daily-report-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  if (!actions || !dispenses || !batches || !settings) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Daily dispensing report</h1>
          <p className="mt-1 text-sm text-muted-foreground">{new Date().toLocaleDateString()} — end-of-day summary.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          <Download className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="min-w-0"><CardBody className="text-center"><PackageCheck className="mx-auto size-5 text-safe-fg" aria-hidden="true" /><p className="mt-1 text-2xl font-semibold text-foreground">{today.dispensed}</p><p className="text-xs text-muted-foreground">Dispensed</p></CardBody></Card>
        <Card className="min-w-0"><CardBody className="text-center"><PauseCircle className="mx-auto size-5 text-caution-fg" aria-hidden="true" /><p className="mt-1 text-2xl font-semibold text-foreground">{today.holds}</p><p className="text-xs text-muted-foreground">Holds / queries</p></CardBody></Card>
        <Card className="min-w-0"><CardBody className="text-center"><XCircle className="mx-auto size-5 text-blocked-fg" aria-hidden="true" /><p className="mt-1 text-2xl font-semibold text-foreground">{today.rejections}</p><p className="text-xs text-muted-foreground">Rejections</p></CardBody></Card>
        <Card className="min-w-0"><CardBody className="text-center"><Stethoscope className="mx-auto size-5 text-brand" aria-hidden="true" /><p className="mt-1 text-2xl font-semibold text-foreground">{today.interventions}</p><p className="text-xs text-muted-foreground">Interventions</p></CardBody></Card>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-foreground">Interventions logged today</h2>
          {today.interventionList.length === 0 && <p className="text-sm text-muted-foreground">None logged today.</p>}
          <ul className="stagger space-y-2">
            {today.interventionList.map((a) => (
              <li key={a.id} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <p className="text-secondary">{a.reason}</p>
                {a.interventionOutcome && <p className="text-muted-foreground">Outcome: {a.interventionOutcome}</p>}
                <p className="text-xs text-subtle">{profiles?.get(a.pharmacistId)?.name ?? a.pharmacistId} · {formatDateTime(a.timestamp)}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardBody className="space-y-2">
            <h2 className="font-semibold text-foreground">Low stock</h2>
            {attention.low.length === 0 ? <p className="text-sm text-muted-foreground">All above threshold.</p> : (
              <div className="flex flex-wrap gap-1.5">{attention.low.map((n) => <Badge key={n} tone="caution">{n}</Badge>)}</div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-2">
            <h2 className="font-semibold text-foreground">Near expiry</h2>
            {attention.nearExpiry.length === 0 ? <p className="text-sm text-muted-foreground">None within window.</p> : (
              <ul className="space-y-1 text-sm text-secondary">{attention.nearExpiry.map((n) => <li key={n}>{n}</li>)}</ul>
            )}
          </CardBody>
        </Card>
      </div>

      <p className="text-center text-sm text-subtle">
        Full audit trail lives in the <Link href="/pharmacist/error-log" className="text-brand hover:underline">Error &amp; Flag Log</Link>.
      </p>
    </div>
  );
}
