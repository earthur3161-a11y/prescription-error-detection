"use client";

import { InventoryManager } from "@/components/pharmacy/InventoryManager";

export default function InventoryPage() {
  return (
    <InventoryManager
      promoHref="/pharmacist/verify/new"
      promoLabel="Verify a prescription"
      promoTitle="Have a prescription to dispense?"
      promoDescription="Screen it for allergies, interactions, and dosing before you hand it over."
    />
  );
}
