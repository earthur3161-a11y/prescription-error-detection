"use client";

import { useRouter } from "next/navigation";
import { PrescriptionBuilder } from "@/components/prescription/PrescriptionBuilder";
import { useAuth } from "@/lib/auth/useAuth";

export default function PharmacistVerifyNewPage() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <PrescriptionBuilder
      title="Verify a prescription"
      subtitle="Enter the drugs from the prescription in hand — each line is screened instantly against allergies, interactions, duplicate therapy, and dosing guidelines before you dispense."
      prescriberId={user.id}
      source="walk_in"
      allowPatientCreate
      onSubmitted={(id) => router.push(`/pharmacist/review/${id}`)}
    />
  );
}
