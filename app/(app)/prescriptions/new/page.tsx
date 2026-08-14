"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrescriptionBuilder } from "@/components/prescription/PrescriptionBuilder";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useAuth } from "@/lib/auth/useAuth";

// Pharmacist-authored prescriptions have their own correct entry point
// (/pharmacist/verify/new, source: "walk_in") — nothing here gated that on
// role before, so a pharmacist navigating here directly could create a
// prescriber_id = themselves row hardcoded to source: "physician", a
// mislabeled record that looks like it came from the physician workflow
// when it didn't.
export default function NewPrescriptionPage() {
  return (
    <RoleGuard allowedRoles={["prescriber"]}>
      <Suspense fallback={null}>
        <NewPrescriptionWorkspace />
      </Suspense>
    </RoleGuard>
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
      institutionId={user.institutionId}
      source="physician"
      allowPatientCreate
      initialPatientId={searchParams.get("patientId")}
      onSubmitted={(id) => router.push(`/prescriptions/${id}`)}
    />
  );
}
