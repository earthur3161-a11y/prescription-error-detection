"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageShell } from "@/components/layout/PageShell";
import { InventoryManager } from "@/components/pharmacy/InventoryManager";
import { useAuth } from "@/lib/auth/useAuth";

/**
 * Self-service stock inventory for an independent physician (no
 * institution — same audience as app/(app)/formulary/page.tsx) dispensing
 * their own prescriptions from their own private stock
 * (0033_independent_physician_self_service.sql). Institution-affiliated
 * physicians are dispensed through their institution's pharmacy instead, so
 * this page explains rather than hard-blocks when one reaches it directly —
 * batches_insert_own is the real enforcement either way.
 */
export default function MyInventoryPage() {
  const { user } = useAuth();
  const isIndependentPrescriber = !!user && user.role === "prescriber" && !user.institutionId;

  if (user && !isIndependentPrescriber) {
    return (
      <PageShell maxWidth="2xl" className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Inventory</h1>
        <Notice tone="neutral">
          {user.role === "pharmacist"
            ? "Pharmacist stock lives in the Pharmacist portal's own Inventory."
            : "Your own stock inventory is for independent physicians dispensing their own prescriptions. Institution-affiliated care is dispensed through your institution's pharmacy instead."}
        </Notice>
        {user.role === "pharmacist" && (
          <Link href="/pharmacist/inventory">
            <Button variant="secondary">Go to Pharmacist Inventory</Button>
          </Link>
        )}
      </PageShell>
    );
  }

  return (
    <InventoryManager
      promoHref="/prescriptions/new"
      promoLabel="New Prescription"
      promoTitle="Have a new prescription to write?"
      promoDescription="Screen it for allergies, interactions, and dosing — then dispense straight from your own stock once it clears."
    />
  );
}
