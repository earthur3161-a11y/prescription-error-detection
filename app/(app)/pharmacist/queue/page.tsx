"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardPlus, Package, QrCode, Search, ShieldAlert, UserRound } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { RiskScoreBadge } from "@/components/pharmacy/RiskScoreBadge";
import { PharmacyStatusBadge } from "@/components/pharmacy/PharmacyStatusBadge";
import { SourceBadge } from "@/components/prescription/SourceBadge";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { useBatches, usePharmacySettings } from "@/lib/query/hooks/usePharmacy";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict } from "@/lib/screening-engine";
import { pharmacyStateOf, PHARMACY_STATE_META, ACTIVE_QUEUE_STATES, type PharmacyState } from "@/lib/pharmacy/status";
import { effectiveBatchStatus } from "@/lib/pharmacy/inventory";

const RISK_ORDER = { blocked: 0, caution: 1, safe: 2 } as const;

export default function PharmacyQueuePage() {
  const [stateFilter, setStateFilter] = useState<PharmacyState | "all">("all");
  const [patientQuery, setPatientQuery] = useState("");

  const { data: prescriptions, isLoading } = usePrescriptions({});
  const { data: patients } = usePatients();
  const { data: batches } = useBatches();
  const { data: settings } = usePharmacySettings();

  const patientNameById = useMemo(
    () => new Map((patients ?? []).map((p) => [p.id, p.name])),
    [patients]
  );

  // Inventory alerts summary.
  const alerts = useMemo(() => {
    if (!batches || !settings) return { lowStock: 0, nearExpiry: 0, expired: 0 };
    const lowStockDrugs = new Set<string>();
    let nearExpiry = 0;
    let expired = 0;
    const totalByDrug = new Map<string, number>();
    for (const b of batches) {
      const status = effectiveBatchStatus(b, settings.nearExpiryDays);
      if (status === "near_expiry") nearExpiry++;
      if (status === "expired") expired++;
      if (status !== "expired" && status !== "recalled") {
        totalByDrug.set(b.drugId, (totalByDrug.get(b.drugId) ?? 0) + b.quantityRemaining);
      }
    }
    for (const [drugId, total] of totalByDrug) {
      const threshold = settings.perDrugLowStock[drugId] ?? settings.defaultLowStockThreshold;
      if (total < threshold) lowStockDrugs.add(drugId);
    }
    return { lowStock: lowStockDrugs.size, nearExpiry, expired };
  }, [batches, settings]);

  const queue = useMemo(() => {
    return (prescriptions ?? [])
      .map((rx) => ({ rx, state: pharmacyStateOf(rx.status) }))
      .filter((x): x is { rx: (typeof x)["rx"]; state: PharmacyState } => x.state !== null && ACTIVE_QUEUE_STATES.includes(x.state))
      .filter((x) => stateFilter === "all" || x.state === stateFilter)
      .sort((a, b) => RISK_ORDER[overallVerdict(a.rx.verdicts)] - RISK_ORDER[overallVerdict(b.rx.verdicts)]);
  }, [prescriptions, stateFilter]);

  const patientMatches = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return [];
    const digits = q.replace(/\D/g, "");
    return (patients ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (!!digits && (p.phone ?? "").replace(/\D/g, "").includes(digits))
    );
  }, [patients, patientQuery]);

  const activePrescriptionsByPatient = useMemo(() => {
    const map = new Map<string, typeof queue>();
    for (const item of queue) {
      const list = map.get(item.rx.patientId) ?? [];
      list.push(item);
      map.set(item.rx.patientId, list);
    }
    return map;
  }, [queue]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Prescription Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">Receive, verify, and dispense — one prescription at a time.</p>
      </div>

      {/* Inventory alerts */}
      {(alerts.lowStock > 0 || alerts.nearExpiry > 0 || alerts.expired > 0) && (
        <Link href="/pharmacist/inventory">
          <Card className="border-caution-border bg-caution-bg/40 transition-shadow hover:shadow-md">
            <CardBody className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-caution-fg">
                <ShieldAlert className="size-4" aria-hidden="true" />
                Inventory needs attention
              </span>
              {alerts.lowStock > 0 && <span className="text-secondary">{alerts.lowStock} low-stock</span>}
              {alerts.nearExpiry > 0 && <span className="text-secondary">{alerts.nearExpiry} near-expiry</span>}
              {alerts.expired > 0 && <span className="text-secondary">{alerts.expired} expired</span>}
              <span className="ml-auto text-brand">Open inventory →</span>
            </CardBody>
          </Card>
        </Link>
      )}

      {/* Receive */}
      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Receive a prescription</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/pharmacist/queue/pull-check">
              <Button variant="secondary" className="w-full justify-start">
                <QrCode className="size-5" aria-hidden="true" />
                Scan QR / enter code
              </Button>
            </Link>
            <Link href="/pharmacist/queue/walk-in">
              <Button variant="secondary" className="w-full justify-start">
                <ClipboardPlus className="size-5" aria-hidden="true" />
                Walk-in (manual entry)
              </Button>
            </Link>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-secondary">Find a patient (name, phone, or ID)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
              <Input
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="e.g. Kojo, 020 444, or patient_…"
                className="pl-9"
              />
            </div>
            {patientQuery.trim() && (
              <div className="mt-2 space-y-2">
                {patientMatches.length === 0 && (
                  <p className="text-sm text-muted-foreground">No patient matches. Use walk-in manual entry for a new patient.</p>
                )}
                {patientMatches.map((p) => {
                  const theirs = activePrescriptionsByPatient.get(p.id) ?? [];
                  return (
                    <div key={p.id} className="rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2 text-sm">
                        <UserRound className="size-4 text-subtle" aria-hidden="true" />
                        <span className="font-medium text-foreground">{p.name}</span>
                        {p.phone && <span className="text-subtle">· {p.phone}</span>}
                        <Link href={`/patients/${p.id}`} className="ml-auto text-xs font-medium text-brand hover:underline">
                          Profile
                        </Link>
                      </div>
                      {theirs.length > 0 ? (
                        <ul className="mt-1.5 space-y-1">
                          {theirs.map(({ rx, state }) => (
                            <li key={rx.id}>
                              <Link href={`/pharmacist/review/${rx.id}`} className="flex items-center justify-between gap-2 text-sm text-secondary hover:text-brand">
                                <span>{formatDateTime(rx.createdAt)} · {rx.drugs.length} drug{rx.drugs.length === 1 ? "" : "s"}</span>
                                <span className="text-xs">{PHARMACY_STATE_META[state].label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-subtle">No active prescriptions in the queue.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Queue with status filter */}
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", ...ACTIVE_QUEUE_STATES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStateFilter(s)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                stateFilter === s ? "bg-brand text-white" : "bg-muted text-secondary hover:bg-muted"
              }`}
            >
              {s === "all" ? "All active" : PHARMACY_STATE_META[s].label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {!isLoading && queue.length === 0 && (
          <Card>
            <CardBody className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Package className="size-6 text-slate-300" aria-hidden="true" />
              Nothing in the queue for this filter.
            </CardBody>
          </Card>
        )}

        <div className="space-y-3">
          {queue.map(({ rx }) => (
            <Link key={rx.id} href={`/pharmacist/review/${rx.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{patientNameById.get(rx.patientId) ?? "Unknown patient"}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(rx.createdAt)} · {rx.drugs.length} drug{rx.drugs.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SourceBadge source={rx.source} />
                    <PharmacyStatusBadge status={rx.status} />
                    <RiskScoreBadge verdict={overallVerdict(rx.verdicts)} size="sm" />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
