"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { DispenseFlow } from "@/components/pharmacy/DispenseFlow";
import { usePrescription } from "@/lib/query/hooks/usePrescriptions";
import { useAuth } from "@/lib/auth/useAuth";

/**
 * Independent-physician self-dispense (0033_independent_physician_self_
 * service.sql). No layout.tsx guards /prescriptions/* the way
 * app/(app)/pharmacist/layout.tsx guards the pharmacist portal — any role
 * can view a prescription's own detail page — so this route checks role +
 * ownership itself before rendering DispenseFlow. The real enforcement is
 * still server-side: prescriptions_select_own for the fetch below, and
 * /api/pharmacy/dispense's ownPrescriptionSelfDispense check for the write.
 */
export default function PrescriberDispensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, role } = useAuth();
  const { data: prescription, isLoading } = usePrescription(id);

  if (isLoading) {
    return (
      <PageShell className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </PageShell>
    );
  }

  const isIndependentPrescriber = !!user && role === "prescriber" && !user.institutionId;
  const ownPrescription = isIndependentPrescriber && !!prescription && prescription.prescriberId === user.id;

  if (!ownPrescription) {
    return (
      <PageShell maxWidth="2xl" className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Dispense</h1>
        <Notice tone="neutral">
          {isIndependentPrescriber
            ? "This isn't your own prescription to dispense."
            : "Self-service dispensing is for independent physicians dispensing their own prescriptions."}
        </Notice>
        <Link href={`/prescriptions/${id}`}>
          <Button variant="secondary">Back to prescription</Button>
        </Link>
      </PageShell>
    );
  }

  return <DispenseFlow id={id} backHref={`/prescriptions/${id}`} backTarget="prescription" />;
}
