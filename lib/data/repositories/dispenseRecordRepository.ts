import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { Batch, DispenseRecord } from "../../types";

/**
 * Finalises a dispense: writes the immutable DispenseRecord and decrements the
 * batch's on-hand quantity in one transaction, so inventory can never drift
 * from what was actually handed to the patient. Returns null if the batch is
 * missing or lacks sufficient stock (defensive — the UI checks first).
 */
export async function createDispenseRecord(
  entry: Omit<DispenseRecord, "id" | "dispensedAt">
): Promise<DispenseRecord | null> {
  await ensureSeeded();
  return db.transaction("rw", [db.dispenseRecords, db.batches, db.stockAdjustments], async () => {
    const batch = await db.batches.get(entry.batchId);
    if (!batch || batch.quantityRemaining < entry.quantityDispensed) return null;

    const record: DispenseRecord = {
      ...entry,
      id: generateId("disp"),
      dispensedAt: new Date().toISOString(),
    };
    const updatedBatch: Batch = {
      ...batch,
      quantityRemaining: batch.quantityRemaining - entry.quantityDispensed,
    };
    await db.dispenseRecords.put(record);
    await db.batches.put(updatedBatch);
    await db.stockAdjustments.put({
      id: generateId("adj"),
      batchId: batch.id,
      drugId: batch.drugId,
      pharmacistId: entry.pharmacistId,
      adjustmentType: "removal",
      quantity: -entry.quantityDispensed,
      reason: `Dispensed against prescription ${entry.prescriptionId.replace("rx_", "")}`,
      timestamp: new Date().toISOString(),
    });
    return record;
  });
}

export async function listDispenseRecords(): Promise<DispenseRecord[]> {
  await ensureSeeded();
  const all = await db.dispenseRecords.toArray();
  return all.sort((a, b) => b.dispensedAt.localeCompare(a.dispensedAt));
}

export async function listDispenseRecordsByPatient(patientId: string): Promise<DispenseRecord[]> {
  await ensureSeeded();
  const all = await db.dispenseRecords.where("patientId").equals(patientId).toArray();
  return all.sort((a, b) => b.dispensedAt.localeCompare(a.dispensedAt));
}
