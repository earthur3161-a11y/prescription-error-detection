import type { Batch, FormularyBundle, PharmacySettings } from "../../types";

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_PHARMACY_SETTINGS: PharmacySettings = {
  id: "local",
  defaultLowStockThreshold: 20,
  nearExpiryDays: 60,
  perDrugLowStock: {},
};

/**
 * Seeds a small independent pharmacy's stock. Deliberately mixes healthy
 * batches, a near-expiry batch (should be picked first by FEFO and raise a
 * near-expiry alert), an expired batch (must be excluded from FEFO and blocked
 * at dispense), and a couple of low-quantity batches (low-stock alert).
 */
export function buildSeedBatches(formulary: FormularyBundle): Batch[] {
  const has = (id: string) => formulary.drugs.some((d) => d.id === id);
  const rows: Array<Omit<Batch, "status">> = [
    // Healthy, plenty of stock, long-dated.
    { id: "batch_para_1", drugId: "drug_paracetamol", batchNumber: "PARA-2405", supplier: "Ernest Chemists", receivedDate: isoDate(-120), expiryDate: isoDate(540), quantityRemaining: 320 },
    // Near-expiry (within default 60d window) — FEFO should prefer this one.
    { id: "batch_para_2", drugId: "drug_paracetamol", batchNumber: "PARA-2312", supplier: "Kinapharma", receivedDate: isoDate(-300), expiryDate: isoDate(38), quantityRemaining: 60 },
    { id: "batch_amox_1", drugId: "drug_amoxicillin", batchNumber: "AMOX-2404", supplier: "Ayrton Drug", receivedDate: isoDate(-90), expiryDate: isoDate(400), quantityRemaining: 140 },
    // Expired — must be excluded from FEFO and hard-blocked at dispense.
    { id: "batch_amox_0", drugId: "drug_amoxicillin", batchNumber: "AMOX-2210", supplier: "Ayrton Drug", receivedDate: isoDate(-600), expiryDate: isoDate(-20), quantityRemaining: 25 },
    { id: "batch_amlo_1", drugId: "drug_amlodipine", batchNumber: "AMLO-2403", supplier: "Kinapharma", receivedDate: isoDate(-150), expiryDate: isoDate(600), quantityRemaining: 200 },
    { id: "batch_metf_1", drugId: "drug_metformin", batchNumber: "METF-2402", supplier: "Ernest Chemists", receivedDate: isoDate(-100), expiryDate: isoDate(500), quantityRemaining: 260 },
    // Low stock (below default threshold of 20).
    { id: "batch_ibup_1", drugId: "drug_ibuprofen", batchNumber: "IBUP-2401", supplier: "Danadams", receivedDate: isoDate(-200), expiryDate: isoDate(300), quantityRemaining: 12 },
    { id: "batch_cipro_1", drugId: "drug_ciprofloxacin", batchNumber: "CIPR-2405", supplier: "Ayrton Drug", receivedDate: isoDate(-60), expiryDate: isoDate(420), quantityRemaining: 90 },
    { id: "batch_coartem_1", drugId: "drug_artemether_lumefantrine", batchNumber: "COAR-2404", supplier: "Kinapharma", receivedDate: isoDate(-80), expiryDate: isoDate(365), quantityRemaining: 75 },
    // Low stock + near-expiry combined.
    { id: "batch_warf_1", drugId: "drug_warfarin", batchNumber: "WARF-2311", supplier: "Ernest Chemists", receivedDate: isoDate(-280), expiryDate: isoDate(50), quantityRemaining: 8 },
    { id: "batch_metro_1", drugId: "drug_metronidazole", batchNumber: "METR-2403", supplier: "Danadams", receivedDate: isoDate(-110), expiryDate: isoDate(450), quantityRemaining: 130 },
    { id: "batch_omep_1", drugId: "drug_omeprazole", batchNumber: "OMEP-2404", supplier: "Kinapharma", receivedDate: isoDate(-70), expiryDate: isoDate(480), quantityRemaining: 160 },
  ];

  return rows
    .filter((r) => has(r.drugId))
    .map((r) => ({ ...r, status: "active" as const }));
}
