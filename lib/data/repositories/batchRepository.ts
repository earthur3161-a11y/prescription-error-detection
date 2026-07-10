import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { Batch, StockAdjustment, StockAdjustmentType } from "../../types";

export async function listBatches(): Promise<Batch[]> {
  await ensureSeeded();
  return db.batches.toArray();
}

export async function listBatchesByDrug(drugId: string): Promise<Batch[]> {
  await ensureSeeded();
  return db.batches.where("drugId").equals(drugId).toArray();
}

export async function getBatch(id: string): Promise<Batch | null> {
  await ensureSeeded();
  return (await db.batches.get(id)) ?? null;
}

export async function addBatch(
  batch: Omit<Batch, "id" | "status">,
  pharmacistId: string
): Promise<Batch> {
  await ensureSeeded();
  const full: Batch = { ...batch, id: generateId("batch"), status: "active" };
  await db.transaction("rw", [db.batches, db.stockAdjustments], async () => {
    await db.batches.put(full);
    await db.stockAdjustments.put({
      id: generateId("adj"),
      batchId: full.id,
      drugId: full.drugId,
      pharmacistId,
      adjustmentType: "addition",
      quantity: full.quantityRemaining,
      reason: `New delivery — batch ${full.batchNumber} from ${full.supplier}`,
      timestamp: new Date().toISOString(),
    });
  });
  return full;
}

/**
 * Applies a signed quantity delta to a batch and writes an immutable
 * StockAdjustment in the same transaction, so on-hand quantity and the audit
 * trail never diverge. Returns null if the adjustment would drive stock
 * negative.
 */
export async function applyStockAdjustment(params: {
  batchId: string;
  pharmacistId: string;
  adjustmentType: StockAdjustmentType;
  quantity: number; // signed delta
  reason: string;
}): Promise<Batch | null> {
  await ensureSeeded();
  return db.transaction("rw", [db.batches, db.stockAdjustments], async () => {
    const batch = await db.batches.get(params.batchId);
    if (!batch) return null;
    const next = batch.quantityRemaining + params.quantity;
    if (next < 0) return null;
    const updated: Batch = { ...batch, quantityRemaining: next };
    await db.batches.put(updated);
    await db.stockAdjustments.put({
      id: generateId("adj"),
      batchId: batch.id,
      drugId: batch.drugId,
      pharmacistId: params.pharmacistId,
      adjustmentType: params.adjustmentType,
      quantity: params.quantity,
      reason: params.reason,
      timestamp: new Date().toISOString(),
    });
    return updated;
  });
}

export async function setBatchRecalled(batchId: string, recalled: boolean): Promise<void> {
  await ensureSeeded();
  await db.batches.update(batchId, { status: recalled ? "recalled" : "active" });
}

export async function listStockAdjustments(): Promise<StockAdjustment[]> {
  await ensureSeeded();
  const all = await db.stockAdjustments.toArray();
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
