"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, FilePlus2, Pencil } from "lucide-react";
import { PatientCard } from "@/components/patient/PatientCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { PrescriptionStatusBadge } from "@/components/prescription/PrescriptionStatusBadge";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useFormulary } from "@/lib/query/hooks/useFormulary";
import { usePrescriptions } from "@/lib/query/hooks/usePrescriptions";
import { useDispenseRecordsByPatient } from "@/lib/query/hooks/usePharmacy";
import { useAuth } from "@/lib/auth/useAuth";
import { formatDateTime } from "@/lib/utils/date";
import { overallVerdict } from "@/lib/screening-engine";

export default function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: patient, isLoading } = usePatient(id);
  const { data: formulary } = useFormulary();
  const { data: prescriptions } = usePrescriptions({ patientId: id, currentOnly: true });
  const { data: dispenses } = useDispenseRecordsByPatient(id);

  if (isLoading || !formulary) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!patient) {
    return <div className="mx-auto max-w-3xl p-8 text-center text-muted-foreground">Patient not found.</div>;
  }

  // patients_update_own (0004_multitenancy_foundation.sql) scopes edits to
  // the prescriber who created the record — hide the entry point rather
  // than send someone to an edit page that will just refuse them.
  const canEdit = !!user && patient.ownerId === user.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 sm:p-8">
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to patients
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PatientCard patient={patient} drugs={formulary.drugs} />
        {canEdit && (
          <Link href={`/patients/${patient.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          </Link>
        )}
      </div>

      <Link href={`/prescriptions/new?patientId=${patient.id}`}>
        <Button>
          <FilePlus2 className="size-5" aria-hidden="true" />
          New Prescription for {patient.name}
        </Button>
      </Link>

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Prescription History</h2>
        {(prescriptions?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No prescriptions on file for this patient.</p>
        )}
        <div className="stagger space-y-3">
          {(prescriptions ?? []).map((rx) => (
            <Link key={rx.id} href={`/prescriptions/${rx.id}`}>
              <Card className="transition-all active:scale-[0.98] hover:shadow-md">
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-secondary">{formatDateTime(rx.createdAt)}</p>
                  <div className="flex items-center gap-2">
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
      </div>

      {dispenses && dispenses.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-foreground">Dispensing History</h2>
          <Card>
            <CardBody>
              <ul className="stagger divide-y divide-border">
                {dispenses.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-foreground">
                      {d.drugName} <span className="text-subtle">× {d.quantityDispensed}</span>
                    </span>
                    <span className="text-subtle">{formatDateTime(d.dispensedAt)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
