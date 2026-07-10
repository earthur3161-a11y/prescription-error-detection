"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { PrescriptionStatusBadge } from "@/components/prescription/PrescriptionStatusBadge";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { useOverrideLogs } from "@/lib/query/hooks/useOverrideLogs";
import { useFacilityPolicy, useUpdateFacilityPolicy } from "@/lib/query/hooks/useFacilityPolicy";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict } from "@/lib/screening-engine";

export default function AdminPipelinePage() {
  const { data: policy, isLoading: policyLoading } = useFacilityPolicy();
  const updatePolicy = useUpdateFacilityPolicy();
  const { data: prescriptions, isLoading } = usePrescriptions({});
  const { data: patients } = usePatients();
  const { data: overrideLogs } = useOverrideLogs();

  const patientNameById = useMemo(
    () => new Map((patients ?? []).map((p) => [p.id, p.name])),
    [patients]
  );
  const overrideCountByPrescription = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of overrideLogs ?? []) {
      map.set(log.prescriptionId, (map.get(log.prescriptionId) ?? 0) + 1);
    }
    return map;
  }, [overrideLogs]);

  const hospitalRx = (prescriptions ?? []).filter((rx) => rx.source === "hospital");
  const awaitingCosign = hospitalRx
    .filter((rx) => rx.status === "pending_admin_cosign")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const recentActivity = [...hospitalRx]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Prescription Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every doctor-authored prescription is re-screened here before it can reach the
          pharmacist queue — this checkpoint isn&rsquo;t optional or skippable from the
          prescriber&rsquo;s side.
        </p>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-secondary">Blocked-verdict policy</p>
            <p className="text-sm text-muted-foreground">
              Controls whether a doctor-authored prescription that resolves to Blocked at this
              checkpoint must wait for your co-sign, or can proceed automatically once the
              prescriber has logged an override.
            </p>
          </div>
          {policyLoading || !policy ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <Select
              value={policy.requireAdminCosignOnBlocked ? "required" : "not_required"}
              onChange={(e) =>
                updatePolicy.mutate({ requireAdminCosignOnBlocked: e.target.value === "required" })
              }
              className="max-w-[220px]"
            >
              <option value="required">Require Admin co-sign</option>
              <option value="not_required">Auto-clear with override</option>
            </Select>
          )}
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Awaiting your co-sign</h2>
        {isLoading && <Skeleton className="h-20 w-full" />}
        {!isLoading && awaitingCosign.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing is currently held for co-sign.</p>
        )}
        <div className="space-y-3">
          {awaitingCosign.map((rx) => (
            <Link key={rx.id} href={`/prescriptions/${rx.id}`}>
              <Card className="border-l-4 border-l-blocked-fg transition-shadow hover:shadow-md">
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
                    {(overrideCountByPrescription.get(rx.id) ?? 0) > 0 && (
                      <Badge tone="caution">
                        <ShieldAlert className="size-3.5" aria-hidden="true" />
                        {overrideCountByPrescription.get(rx.id)} override
                        {overrideCountByPrescription.get(rx.id) === 1 ? "" : "s"}
                      </Badge>
                    )}
                    <VerdictBadge verdict={overallVerdict(rx.verdicts)} size="sm" />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Recent pipeline activity</h2>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!isLoading && recentActivity.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No doctor-authored prescriptions yet.</p>
        )}
        <div className="space-y-2">
          {recentActivity.map((rx) => (
            <Link key={rx.id} href={`/prescriptions/${rx.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {patientNameById.get(rx.patientId) ?? "Unknown patient"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(rx.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <VerdictBadge verdict={overallVerdict(rx.verdicts)} size="sm" />
                    <PrescriptionStatusBadge status={rx.status} />
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
