"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrescriptionBuilder } from "@/components/prescription/PrescriptionBuilder";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePrescription } from "@/lib/query/hooks/usePrescriptions";
import { useAuth } from "@/lib/auth/useAuth";
import { isPrescriptionEditable } from "@/lib/types";

export default function EditPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { data: prescription, isLoading } = usePrescription(id);

  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Skeleton className="h-8 w-48" />
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

  // Mirrors create_prescription_version()'s own guards exactly (0016/0025) —
  // this is a friendly pre-check, not the real enforcement, which is the RPC.
  const isOwner = prescription.prescriberId === user.id;
  const isEditable = isPrescriptionEditable(prescription);
  if (!isOwner || !isEditable) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6 sm:p-8">
        <Link
          href={`/prescriptions/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to prescription
        </Link>
        <p className="text-muted-foreground">
          {!isOwner
            ? "Only the original prescriber can edit this prescription."
            : "This prescription can no longer be edited — its status has moved past the editable stage."}
        </p>
      </div>
    );
  }

  return (
    <PrescriptionBuilder
      title="Edit Prescription"
      subtitle="Changes create a new version — the version being replaced is preserved, never overwritten."
      prescriberId={user.id}
      institutionId={user.institutionId}
      source={prescription.source}
      externalPrescriberName={prescription.externalPrescriberName}
      patientCheckId={prescription.patientCheckId}
      initialPatientId={prescription.patientId}
      initialLines={prescription.drugs}
      editingPrescriptionId={prescription.id}
      onSubmitted={(newId) => router.push(`/prescriptions/${newId}`)}
    />
  );
}
