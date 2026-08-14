"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PatientForm } from "@/components/patient/PatientForm";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePatient } from "@/lib/query/hooks/usePatient";
import { useAuth } from "@/lib/auth/useAuth";

export default function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: patient, isLoading } = usePatient(id);

  if (isLoading || !user) {
    return (
      <PageShell className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (!patient) {
    return <PageShell className="p-8 text-center text-muted-foreground">Patient not found.</PageShell>;
  }

  // Friendly pre-check, not the real enforcement — patients_update_own
  // (0004_multitenancy_foundation.sql) scopes the actual UPDATE to owner_id.
  const isOwner = patient.ownerId === user.id;
  if (!isOwner) {
    return (
      <PageShell className="space-y-4">
        <Link
          href={`/patients/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to patient
        </Link>
        <p className="text-muted-foreground">Only the physician who added this patient can edit their details.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Link
        href={`/patients/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to patient
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Edit {patient.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fields left unanswered are recorded as unknown, never as confirmed absent.
        </p>
      </div>

      <PatientForm patient={patient} />
    </PageShell>
  );
}
