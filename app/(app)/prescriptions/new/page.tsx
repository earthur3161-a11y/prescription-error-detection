"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrescriptionBuilder } from "@/components/prescription/PrescriptionBuilder";
import { useAuth } from "@/lib/auth/useAuth";

export default function NewPrescriptionPage() {
  return (
    <Suspense fallback={null}>
      <NewPrescriptionWorkspace />
    </Suspense>
  );
}

function NewPrescriptionWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <PrescriptionBuilder
      title="New Prescription"
      subtitle="Add drugs below — each line is screened instantly against allergies, interactions, duplicate therapy, and dosing guidelines."
      prescriberId={user.id}
      source="physician"
      initialPatientId={searchParams.get("patientId")}
      onSubmitted={(id) => router.push(`/prescriptions/${id}`)}
    />
  );
}
