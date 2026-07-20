"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, NotebookPen, Pill } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { RiskScoreBadge } from "@/components/pharmacy/RiskScoreBadge";
import { FindingsPanel } from "@/components/pharmacy/FindingsPanel";
import { PharmacistActionBar } from "@/components/pharmacy/PharmacistActionBar";
import { PharmacyStatusBadge } from "@/components/pharmacy/PharmacyStatusBadge";
import { SourceBadge } from "@/components/prescription/SourceBadge";
import { ScreeningCoverageNotice } from "@/components/prescription/ScreeningCoverageNotice";
import { usePrescription } from "@/lib/query/hooks/usePrescriptions";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useUpdatePrescriptionStatus } from "@/lib/query/hooks/useUpdatePrescriptionStatus";
import {
  useAppendPharmacistAction,
  usePharmacistActions,
  useUpdatePharmacistNote,
} from "@/lib/query/hooks/usePharmacy";
import { useAuth } from "@/lib/auth/useAuth";
import { useProfiles } from "@/lib/query/hooks/useProfiles";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict, screenDrugLine } from "@/lib/screening-engine";
import { pharmacyStateOf } from "@/lib/pharmacy/status";
import type { PharmacistActionType } from "@/lib/types";

const ACTION_LABEL: Record<PharmacistActionType, string> = {
  approve: "Approved",
  dispense: "Dispensed",
  reject: "Rejected",
  hold: "Held",
  request_clarification: "Requested clarification",
  record_intervention: "Recorded intervention",
};

export default function PharmacistReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const { data: prescription, isLoading } = usePrescription(id);
  const { data: patient } = usePatient(prescription?.patientId ?? null);
  const { data: formulary } = useFormulary();
  const { data: actions } = usePharmacistActions(id);
  const { data: profiles } = useProfiles();

  const updateStatus = useUpdatePrescriptionStatus();
  const appendAction = useAppendPharmacistAction();
  const updateNote = useUpdatePharmacistNote();

  const [note, setNote] = useState("");
  const noteInit = useRef(false);
  const reviewMarked = useRef(false);

  // Auto-transition New -> Under Review the moment the pharmacist opens it.
  useEffect(() => {
    if (!reviewMarked.current && prescription?.status === "submitted") {
      reviewMarked.current = true;
      updateStatus.mutate({ id, status: "under_review" });
    }
  }, [prescription?.status, id, updateStatus]);

  useEffect(() => {
    if (!noteInit.current && prescription) {
      setNote(prescription.pharmacistNote ?? "");
      noteInit.current = true;
    }
  }, [prescription]);

  const { verdicts, allFlags, overall } = useMemo(() => {
    if (!prescription || !formulary) return { verdicts: [], allFlags: [], overall: "safe" as const };
    const v = prescription.drugs.map((line) =>
      screenDrugLine({ patient: patient ?? null, drugLine: line, otherLines: prescription.drugs, formulary })
    );
    return { verdicts: v, allFlags: v.flatMap((x) => x.flags), overall: overallVerdict(v) };
  }, [prescription, patient, formulary]);

  if (isLoading || !formulary || !prescription) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const state = pharmacyStateOf(prescription.status) ?? "new";
  const prescriber = profiles?.get(prescription.prescriberId);
  const drugRefs = prescription.drugs
    .map((l) => formulary.drugs.find((d) => d.id === l.drugId))
    .filter((d): d is NonNullable<typeof d> => !!d)
    .map((d) => ({ id: d.id, name: d.generic_name }));

  const pending = updateStatus.isPending || appendAction.isPending;

  function log(action: PharmacistActionType, extra: Partial<Parameters<typeof appendAction.mutate>[0]> = {}) {
    if (!user) return;
    appendAction.mutate({ prescriptionId: id, pharmacistId: user.id, action, ...extra });
  }

  function handleApprove() {
    log("approve");
    updateStatus.mutate({ id, status: "cleared" });
  }
  function handleHold(reason: string) {
    log("hold", { reason });
    updateStatus.mutate({ id, status: "held" });
  }
  function handleReject(reason: string) {
    log("reject", { reason });
    updateStatus.mutate({ id, status: "rejected", pharmacistNote: reason });
  }
  function handleClarify(drugId: string | undefined, question: string) {
    log("request_clarification", { reason: question, clarificationDrugId: drugId });
    updateStatus.mutate({ id, status: "held" });
  }
  function handleIntervention(reason: string, outcome: string) {
    log("record_intervention", { reason, interventionOutcome: outcome });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6 sm:p-8">
      <Link href="/prescriptions" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to prescriptions
      </Link>

      {/* Header: patient + risk score + always-visible actions */}
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {patient ? (
                  <Link href={`/patients/${patient.id}`} className="hover:text-brand">
                    {patient.name}
                  </Link>
                ) : (
                  "Prescription"
                )}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {patient?.phone ? `${patient.phone} · ` : ""}
                {prescription.externalPrescriberName ?? prescriber?.name ?? "Unknown prescriber"} ·{" "}
                {formatDateTime(prescription.createdAt)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SourceBadge source={prescription.source} />
                <PharmacyStatusBadge status={prescription.status} />
                {patient?.isPregnant && <Badge tone="caution">Pregnant</Badge>}
                {patient?.renalStatus === "impaired" && <Badge tone="caution">Renal impairment</Badge>}
              </div>
            </div>
            <RiskScoreBadge verdict={overall} size="lg" />
          </div>

          <div className="border-t border-border pt-4">
            <PharmacistActionBar
              state={state}
              drugs={drugRefs}
              pending={pending}
              onApprove={handleApprove}
              onHold={handleHold}
              onReject={handleReject}
              onRequestClarification={handleClarify}
              onRecordIntervention={handleIntervention}
              onDispense={() => router.push(`/pharmacist/dispense/${id}`)}
            />
            {state !== "cleared" && state !== "dispensed" && (
              <p className="mt-2 text-xs text-subtle">Dispensing unlocks once the prescription is Approved.</p>
            )}
          </div>
        </CardBody>
      </Card>

      <ScreeningCoverageNotice formulary={formulary} />

      {/* Automated screening findings */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Automated screening findings</h2>
          <FindingsPanel flags={allFlags} />
        </CardBody>
      </Card>

      {/* Drug lines */}
      <Card>
        <CardBody className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Prescription</h2>
          <ul className="divide-y divide-border">
            {prescription.drugs.map((line, i) => {
              const drug = formulary.drugs.find((d) => d.id === line.drugId);
              const v = verdicts[i];
              if (!drug) return null;
              return (
                <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Pill className="size-4 shrink-0 text-brand" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{drug.generic_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.doseMg}mg {line.route} · {line.frequencyPerDay}×/day · {line.durationDays} days
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={drug.onEssentialMedicinesList ? "safe" : "caution"}>
                      {drug.onEssentialMedicinesList ? "EML" : "Non-EML"}
                    </Badge>
                    {v && <RiskScoreBadge verdict={v.verdict} size="sm" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      {/* Pharmacist notes */}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-subtle">
            <NotebookPen className="size-4" aria-hidden="true" />
            Pharmacist notes
          </h2>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Notes attached permanently to this prescription's record…"
          />
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => updateNote.mutate({ id, note: note.trim() })} disabled={updateNote.isPending}>
              Save note
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Action history (immutable audit) */}
      {actions && actions.length > 0 && (
        <Card>
          <CardBody className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Action history</h2>
            <ul className="space-y-2">
              {actions.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="font-medium text-foreground">{ACTION_LABEL[a.action]}</span>
                  <span className="text-subtle">
                    {" "}
                    · {profiles?.get(a.pharmacistId)?.name ?? a.pharmacistId} · {formatDateTime(a.timestamp)}
                  </span>
                  {a.reason && <p className="text-secondary">{a.reason}</p>}
                  {a.interventionOutcome && <p className="text-muted-foreground">Outcome: {a.interventionOutcome}</p>}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
