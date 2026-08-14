"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { PrescriptionStatusBadge } from "@/components/prescription/PrescriptionStatusBadge";
import { SourceBadge } from "@/components/prescription/SourceBadge";
import { Button } from "@/components/ui/Button";
import { PageShell } from "@/components/layout/PageShell";
import { FilePlus2 } from "lucide-react";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { useAuth } from "@/lib/auth/useAuth";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict, type Verdict } from "@/lib/screening-engine";
import type { PrescriptionStatus } from "@/lib/types";

export default function PrescriptionHistoryPage() {
  const { role } = useAuth();
  const isPharmacist = role === "pharmacist";
  const [patientQuery, setPatientQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PrescriptionStatus | "all">("all");

  const { data: prescriptions, isLoading } = usePrescriptions(
    statusFilter === "all" ? { currentOnly: true } : { status: statusFilter, currentOnly: true }
  );
  const { data: patients } = usePatients();
  const patientNameById = useMemo(
    () => new Map((patients ?? []).map((p) => [p.id, p.name])),
    [patients]
  );

  const filtered = (prescriptions ?? []).filter((rx) => {
    const name = patientNameById.get(rx.patientId) ?? "";
    if (patientQuery && !name.toLowerCase().includes(patientQuery.toLowerCase())) return false;
    if (verdictFilter !== "all" && overallVerdict(rx.verdicts) !== verdictFilter) return false;
    return true;
  });

  return (
    <PageShell maxWidth="4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Prescription History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Browse and filter past prescriptions.</p>
        </div>
        {isPharmacist && (
          <Link href="/pharmacist/verify/new">
            <Button size="sm">
              <FilePlus2 className="size-4" aria-hidden="true" />
              Verify a prescription
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Filter by patient name…"
          value={patientQuery}
          onChange={(e) => setPatientQuery(e.target.value)}
          aria-label="Filter by patient name"
        />
        <Select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value as Verdict | "all")}
          aria-label="Filter by verdict"
        >
          <option value="all">All verdicts</option>
          <option value="safe">Safe</option>
          <option value="caution">Caution</option>
          <option value="blocked">Blocked</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as PrescriptionStatus | "all")}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="submitted">Awaiting Verification</option>
          <option value="under_review">Under Review</option>
          <option value="held">Held</option>
          <option value="cleared">Cleared</option>
          <option value="rejected">Rejected</option>
          <option value="verified">Verified</option>
          <option value="dispensed">Dispensed</option>
          <option value="flagged">Flagged</option>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No prescriptions match these filters.</p>
      )}

      <div className="stagger space-y-3">
        {filtered.map((rx) => (
          <Link
            key={rx.id}
            href={isPharmacist ? `/pharmacist/review/${rx.id}` : `/prescriptions/${rx.id}`}
            className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <Card interactive className="active:scale-[0.98]">
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {patientNameById.get(rx.patientId) ?? "Unknown patient"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(rx.createdAt)} · {rx.drugs.length} drug{rx.drugs.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SourceBadge source={rx.source} />
                  <VerdictMark
                    verdict={overallVerdict(rx.verdicts)}
                    flags={rx.verdicts.flatMap((v) => v.flags)}
                    size="chip"
                  />
                  <PrescriptionStatusBadge status={rx.status} />
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
