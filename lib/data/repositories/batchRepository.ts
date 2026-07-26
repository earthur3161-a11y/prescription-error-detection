import { supabase } from "../../supabase/client";
import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { BatchRow } from "../../supabase/types";
import type { Batch, StockAdjustment, StockAdjustmentType } from "../../types";

// Batches moved to Supabase (supabase/migrations/0010) — the dispense gate
// needs a real, shared, RLS-backed source of truth for stock so the
// dispense_drug() RPC can atomically lock and decrement it. StockAdjustment
// (the manual add/correct/remove audit trail) deliberately stays on Dexie —
// out of scope for the dispense-safety path this migration was built for.
// `status` at the DB level is only ever 'active' | 'recalled'; the derived
// 'near_expiry' / 'expired' states are computed client-side from
// expiryDate + settings, same as before (see lib/pharmacy/inventory.ts).

function mapRow(row: BatchRow): Batch {
  return {
    id: row.id,
    drugId: row.drug_id,
    batchNumber: row.batch_number,
    supplier: row.supplier,
    receivedDate: row.received_date,
    expiryDate: row.expiry_date,
    quantityRemaining: row.quantity_remaining,
    status: row.status,
  };
}

export async function listBatches(): Promise<Batch[]> {
  const { data, error } = await supabase.from("batches").select("*").order("expiry_date");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function listBatchesByDrug(drugId: string): Promise<Batch[]> {
  const { data, error } = await supabase.from("batches").select("*").eq("drug_id", drugId).order("expiry_date");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getBatch(id: string): Promise<Batch | null> {
  const { data, error } = await supabase.from("batches").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export async function addBatch(
  batch: Omit<Batch, "id" | "status">,
  pharmacistId: string
): Promise<Batch> {
  const { data, error } = await supabase
    .from("batches")
    .insert({
      drug_id: batch.drugId,
      batch_number: batch.batchNumber,
      supplier: batch.supplier,
      received_date: batch.receivedDate,
      expiry_date: batch.expiryDate,
      quantity_remaining: batch.quantityRemaining,
      status: "active",
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to add batch.");
  const full = mapRow(data);

  await ensureSeeded();
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
  return full;
}

/**
 * Applies a signed quantity delta directly (manual corrections/returns/
 * removals — NOT dispensing, which goes through the atomic dispense_drug()
 * RPC instead). Returns null if the adjustment would drive stock negative.
 */
export async function applyStockAdjustment(params: {
  batchId: string;
  pharmacistId: string;
  adjustmentType: StockAdjustmentType;
  quantity: number; // signed delta
  reason: string;
}): Promise<Batch | null> {
  const batch = await getBatch(params.batchId);
  if (!batch) return null;
  const next = batch.quantityRemaining + params.quantity;
  if (next < 0) return null;

  const { data, error } = await supabase
    .from("batches")
    .update({ quantity_remaining: next })
    .eq("id", params.batchId)
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to adjust stock.");
  const updated = mapRow(data);

  await ensureSeeded();
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
}

export async function setBatchRecalled(batchId: string, recalled: boolean): Promise<void> {
  const { error } = await supabase
    .from("batches")
    .update({ status: recalled ? "recalled" : "active" })
    .eq("id", batchId);
  if (error) throw error;
}

export async function listStockAdjustments(): Promise<StockAdjustment[]> {
  await ensureSeeded();
  const all = await db.stockAdjustments.toArray();
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
