"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, PackageCheck } from "lucide-react";
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
import { usePrescription } from "@/lib/query/hooks/usePrescriptions";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { useOverrideLogs } from "@/lib/query/hooks/useOverrideLogs";
import { useUpdatePrescriptionStatus } from "@/lib/query/hooks/useUpdatePrescriptionStatus";
import { useAuth } from "@/lib/auth/useAuth";
import { useProfiles } from "@/lib/query/hooks/useProfiles";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict } from "@/lib/screening-engine";

export default function PrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { role } = useAuth();
  const { data: prescription, isLoading } = usePrescription(id);
  const { data: patient } = usePatient(prescription?.patientId ?? null);
  const { data: formulary } = useFormulary();
  const { data: overrideLogs } = useOverrideLogs({ prescriptionId: id });
  const { data: profiles } = useProfiles();
  const updateStatus = useUpdatePrescriptionStatus();

  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");

  if (isLoading || !formulary) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center text-muted-foreground">
        Prescription not found.
      </div>
    );
  }

  const prescriber = profiles?.get(prescription.prescriberId);
  const overrideByDrugId = new Map((overrideLogs ?? []).map((log) => [log.drugId, log]));
  const canPharmacistAct = role === "pharmacist" && prescription.status === "submitted";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
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
    </div>
  );
}
