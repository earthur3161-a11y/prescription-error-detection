"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { useOverrideLogs } from "@/lib/query/hooks/useOverrideLogs";
import { usePatients } from "@/lib/query/hooks/usePatients";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useAuth } from "@/lib/auth/useAuth";
import { formatDateTime } from "@/lib/utils/date";

const REASON_LABELS: Record<string, string> = {
  benefit_outweighs_risk: "Benefit outweighs risk",
  verified_with_pharmacist: "Verified with pharmacist",
  patient_tolerates_combination: "Patient already tolerates this combination",
  other: "Other",
};

export default function PharmacistErrorLogPage() {
  const { user } = useAuth();
  // Unfiltered — must resolve overrideLogs against the EXACT prescription
  // version they were logged against, even if that version has since been
  // edited/superseded. Filtering this would make old overrides resolve to
  // "Unknown patient" instead of their real historical context.
  const { data: allPrescriptions } = usePrescriptions({});
  // Current-only — this is a live "still needs attention" work queue; a
  // flagged version that's since been corrected by an edit shouldn't still
  // show up here as outstanding.
  const { data: currentPrescriptions, isLoading: rxLoading } = usePrescriptions({ currentOnly: true });
  const { data: overrideLogs, isLoading: logsLoading } = useOverrideLogs({ userId: user?.id });
  const { data: patients } = usePatients();
  const { data: formulary } = useFormulary();

  const patientNameById = useMemo(
    () => new Map((patients ?? []).map((p) => [p.id, p.name])),
    [patients]
  );
  const drugNameById = useMemo(
    () => new Map((formulary?.drugs ?? []).map((d) => [d.id, d.generic_name])),
    [formulary]
  );
  const prescriptionById = useMemo(
    () => new Map((allPrescriptions ?? []).map((rx) => [rx.id, rx])),
    [allPrescriptions]
  );

  const flagBacks = (currentPrescriptions ?? []).filter(
    (rx) => rx.status === "flagged" && rx.pharmacistNote
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Verification Error Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your flag-back history and the discrepancies you caught while entering prescriptions
          yourself.
        </p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Flagged back to prescriber</h2>
        {rxLoading && <Skeleton className="h-20 w-full" />}
        {!rxLoading && flagBacks.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You haven&rsquo;t flagged anything back to a prescriber yet.
          </p>
        )}
        <div className="stagger space-y-3">
          {flagBacks.map((rx) => (
            <Link
              key={rx.id}
              href={`/prescriptions/${rx.id}`}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Card interactive className="active:scale-[0.98]">
                <CardBody className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {patientNameById.get(rx.patientId) ?? "Unknown patient"}
                    </p>
                    <Badge tone="blocked">Flagged</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDateTime(rx.createdAt)}</p>
                  <p className="text-sm text-secondary">{rx.pharmacistNote}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Overrides you logged</h2>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">
          From walk-in and pulled-up patient-check prescriptions you entered and screened yourself.
        </p>
        {logsLoading && <Skeleton className="h-20 w-full" />}
        {!logsLoading && (overrideLogs?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No overrides logged yet.</p>
        )}
        <div className="stagger space-y-3">
          {(overrideLogs ?? []).map((log) => {
            const rx = prescriptionById.get(log.prescriptionId);
            return (
              <Link
                key={log.id}
                href={`/prescriptions/${log.prescriptionId}`}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Card interactive className="active:scale-[0.98]">
                  <CardBody className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {patientNameById.get(rx?.patientId ?? "") ?? "Unknown patient"} —{" "}
                        {drugNameById.get(log.drugId) ?? log.drugId}
                      </p>
                      <Badge tone={log.verdictOverridden === "blocked" ? "blocked" : "caution"}>
                        Overrode {log.verdictOverridden}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{formatDateTime(log.timestamp)}</p>
                    <p className="text-sm text-secondary">
                      <span className="font-medium">{REASON_LABELS[log.reasonCode] ?? log.reasonCode}</span>
                      {log.reasonText ? ` — ${log.reasonText}` : ""}
                    </p>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
