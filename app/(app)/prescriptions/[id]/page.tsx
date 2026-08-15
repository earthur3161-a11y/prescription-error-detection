"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Flag, HelpCircle, PackageCheck, Pencil, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { PrescriptionStatusBadge } from "@/components/prescription/PrescriptionStatusBadge";
import { PrescriptionLineSummary } from "@/components/prescription/PrescriptionLineSummary";
import { SourceBadge } from "@/components/prescription/SourceBadge";
import { ScreeningCoverageNotice } from "@/components/prescription/ScreeningCoverageNotice";
import { PageShell } from "@/components/layout/PageShell";
import { usePrescription } from "@/lib/query/hooks/usePrescriptions";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useOverrideLogs } from "@/lib/query/hooks/useOverrideLogs";
import { useUpdatePrescriptionStatus } from "@/lib/query/hooks/useUpdatePrescriptionStatus";
import { usePharmacistActions, useAppendPharmacistAction } from "@/lib/query/hooks/usePharmacy";
import { useAuth } from "@/lib/auth/useAuth";
import { useProfiles } from "@/lib/query/hooks/useProfiles";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict } from "@/lib/screening-engine";
import { isPrescriptionEditable } from "@/lib/types";
import { ACTION_ICON, ACTION_LABEL } from "@/lib/pharmacy/actionLabels";

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role, user } = useAuth();
  const { data: prescription, isLoading } = usePrescription(id);
  const { data: patient } = usePatient(prescription?.patientId ?? null);
  const { data: formulary } = useFormulary();
  const { data: overrideLogs } = useOverrideLogs({ prescriptionId: id });
  const { data: profiles } = useProfiles();
  const { data: pharmacistActions } = usePharmacistActions(id);
  const updateStatus = useUpdatePrescriptionStatus();
  const appendAction = useAppendPharmacistAction();

  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [clarificationReply, setClarificationReply] = useState("");

  if (isLoading || !formulary) {
    return (
      <PageShell className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </PageShell>
    );
  }

  if (!prescription) {
    return (
      <PageShell className="p-8 text-center text-muted-foreground">
        Prescription not found.
      </PageShell>
    );
  }

  const prescriber = profiles?.get(prescription.prescriberId);
  const overrideByDrugId = new Map((overrideLogs ?? []).map((log) => [log.drugId, log]));
  const canPharmacistAct = role === "pharmacist" && prescription.status === "submitted";
  // Mirrors create_prescription_version()'s own guards exactly (0016/0025) —
  // only the original prescriber, only while still in an editable status.
  const canPrescriberEdit =
    role === "prescriber" && !!user && prescription.prescriberId === user.id && isPrescriptionEditable(prescription);
  // An independent physician (no institution — same condition
  // prescriptions_update_own/batches_insert_own now check) reviewing their
  // own prescription: a single Approve action, not the full pharmacist
  // toolkit (Hold/Reject/Clarify/Record Intervention don't apply to
  // reviewing your own work — a physician who wants to stop their own
  // prescription already has Cancel above). See
  // 0033_independent_physician_self_service.sql.
  const canPrescriberSelfVerify =
    role === "prescriber" &&
    !!user &&
    !user.institutionId &&
    prescription.prescriberId === user.id &&
    (prescription.status === "submitted" || prescription.status === "under_review");
  // Same independent-physician-own-prescription condition as
  // canPrescriberSelfVerify, once Approve has already moved status to
  // cleared — the entry point into /prescriptions/[id]/dispense, which
  // re-checks this same ownership itself before rendering DispenseFlow.
  const canPrescriberSelfDispense =
    role === "prescriber" &&
    !!user &&
    !user.institutionId &&
    prescription.prescriberId === user.id &&
    prescription.status === "cleared";

  // A flat chronological thread, not paired 1:1 per question — a prescription
  // can have more than one clarification/response over its life, and showing
  // them in order (same convention as the Review page's own Action History)
  // is simpler and more honest than a pairing heuristic that could silently
  // mismatch a response to the wrong question.
  const clarificationThread = (pharmacistActions ?? []).filter(
    (a) => a.action === "request_clarification" || a.action === "prescriber_response"
  );
  const hasClarificationRequest = clarificationThread.some((a) => a.action === "request_clarification");
  // Same ownership check as canPrescriberEdit, deliberately not gated on
  // prescription status — a prescriber should still be able to reply to a
  // past question even if the pharmacist has since moved the prescription on.
  const canRespondToClarification =
    role === "prescriber" && !!user && prescription.prescriberId === user.id && hasClarificationRequest;

  return (
    <PageShell>
      <Link href="/prescriptions" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to prescriptions
      </Link>

      <Card>
        <CardBody className="space-y-3">
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
              <p className="mt-1 text-sm text-muted-foreground">
                Prescribed by {prescription.externalPrescriberName ?? prescriber?.name ?? "unknown"} ·{" "}
                {formatDateTime(prescription.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <VerdictMark
                verdict={overallVerdict(prescription.verdicts)}
                flags={prescription.verdicts.flatMap((v) => v.flags)}
              />
              <PrescriptionStatusBadge status={prescription.status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={prescription.source} />
            {prescription.patientCheckId && (
              <Link
                href={`/check/result/${prescription.patientCheckId}`}
                className="text-sm font-medium text-brand hover:underline"
              >
                View original patient self-check
              </Link>
            )}
          </div>
          {prescription.pharmacistNote && (
            <div className="rounded-lg bg-blocked-bg px-4 py-3 text-sm text-blocked-fg">
              <span className="font-semibold">Pharmacist note: </span>
              {prescription.pharmacistNote}
            </div>
          )}
          {prescription.adminNote && (
            <div className="rounded-lg bg-blocked-bg px-4 py-3 text-sm text-blocked-fg">
              <span className="font-semibold">Facility Admin note: </span>
              {prescription.adminNote}
            </div>
          )}
        </CardBody>
      </Card>

      {clarificationThread.length > 0 && (
        <Card>
          <CardBody className="space-y-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-subtle">
              <HelpCircle className="size-4" aria-hidden="true" />
              Clarification requests
            </h2>
            <ul className="space-y-2.5">
              {clarificationThread.map((a) => {
                const drug = a.clarificationDrugId
                  ? formulary.drugs.find((d) => d.id === a.clarificationDrugId)
                  : undefined;
                const ActionIcon = ACTION_ICON[a.action];
                return (
                  <li key={a.id} className="rounded-lg bg-surface-2 px-3 py-2.5 text-sm">
                    <p className="flex items-center gap-1.5 font-medium text-foreground">
                      <ActionIcon className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                      {ACTION_LABEL[a.action]}
                      {drug && <span className="font-normal text-muted-foreground"> — about {drug.generic_name}</span>}
                    </p>
                    {a.reason && <p className="mt-0.5 text-secondary">{a.reason}</p>}
                    <p className="mt-0.5 text-xs text-subtle">{formatDateTime(a.timestamp)}</p>
                  </li>
                );
              })}
            </ul>
            {canRespondToClarification && (
              <div className="border-t border-border pt-3">
                <label className="mb-1.5 block text-sm font-medium text-secondary">Your response</label>
                <Textarea
                  value={clarificationReply}
                  onChange={(e) => setClarificationReply(e.target.value)}
                  rows={3}
                  placeholder="e.g. Confirmed — the intended frequency is twice daily, not three times."
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    disabled={clarificationReply.trim().length === 0 || !user || appendAction.isPending}
                    onClick={() => {
                      if (!user) return;
                      appendAction.mutate(
                        {
                          prescriptionId: id,
                          pharmacistId: user.id,
                          action: "prescriber_response",
                          actorRole: "prescriber",
                          reason: clarificationReply.trim(),
                        },
                        { onSuccess: () => setClarificationReply("") }
                      );
                    }}
                  >
                    Send response
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <ScreeningCoverageNotice formulary={formulary} />

      <div className="stagger space-y-4">
        {prescription.drugs.map((line, i) => {
          const drug = formulary.drugs.find((d) => d.id === line.drugId);
          const verdict = prescription.verdicts[i];
          if (!drug || !verdict) return null;
          return (
            <PrescriptionLineSummary
              key={line.id}
              drug={drug}
              line={line}
              verdict={verdict}
              overrideLog={overrideByDrugId.get(line.drugId)}
            />
          );
        })}
      </div>

      {canPrescriberEdit && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button variant="secondary" onClick={() => router.push(`/prescriptions/${prescription.id}/edit`)}>
            <Pencil className="size-5" aria-hidden="true" />
            Edit
          </Button>
          <Button variant="secondary" onClick={() => setCancelModalOpen(true)}>
            <XCircle className="size-5" aria-hidden="true" />
            Cancel Prescription
          </Button>
        </div>
      )}

      {canPrescriberSelfVerify && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button
            disabled={appendAction.isPending || updateStatus.isPending}
            onClick={() => {
              if (!user) return;
              appendAction.mutate({ prescriptionId: id, pharmacistId: user.id, action: "approve", actorRole: "prescriber" });
              updateStatus.mutate({ id, status: "cleared" });
            }}
          >
            <CheckCircle2 className="size-5" aria-hidden="true" />
            Approve
          </Button>
        </div>
      )}

      {canPrescriberSelfDispense && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button onClick={() => router.push(`/prescriptions/${prescription.id}/dispense`)}>
            <PackageCheck className="size-5" aria-hidden="true" />
            Dispense
          </Button>
        </div>
      )}

      {canPharmacistAct && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          {/* Navigates into the real gated flow (review -> approve -> dispense)
              rather than setting status directly — this page is a read-only
              detail view, not a substitute for the screening-verified dispense
              gate at /pharmacist/dispense/[id]. See
              0015_close_raw_dispense_status_bypass.sql. */}
          <Button onClick={() => router.push(`/pharmacist/review/${prescription.id}`)}>
            <PackageCheck className="size-5" aria-hidden="true" />
            Review & Dispense
          </Button>
          <Button variant="secondary" onClick={() => setFlagModalOpen(true)}>
            <Flag className="size-5" aria-hidden="true" />
            Flag to Prescriber
          </Button>
        </div>
      )}

      <Modal
        open={flagModalOpen}
        onOpenChange={setFlagModalOpen}
        title="Flag prescription to prescriber"
        description="Add a note explaining why this prescription needs review before it can be dispensed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFlagModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={flagNote.trim().length === 0 || updateStatus.isPending}
              onClick={() => {
                updateStatus.mutate(
                  { id: prescription.id, status: "flagged", pharmacistNote: flagNote.trim() },
                  { onSuccess: () => setFlagModalOpen(false) }
                );
              }}
            >
              Flag prescription
            </Button>
          </>
        }
      >
        <Textarea
          value={flagNote}
          onChange={(e) => setFlagNote(e.target.value)}
          rows={4}
          placeholder="e.g. Please confirm renal function before dispensing…"
        />
      </Modal>

      <Modal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        title="Cancel this prescription?"
        description="The prescription is kept, marked cancelled — it's never deleted. This can't be undone from here; a fresh prescription would be needed to resume treatment."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelModalOpen(false)}>
              Keep prescription
            </Button>
            <Button
              variant="destructive"
              disabled={updateStatus.isPending}
              onClick={() => {
                updateStatus.mutate(
                  { id: prescription.id, status: "cancelled" },
                  { onSuccess: () => setCancelModalOpen(false) }
                );
              }}
            >
              Cancel prescription
            </Button>
          </>
        }
      />
    </PageShell>
  );
}
