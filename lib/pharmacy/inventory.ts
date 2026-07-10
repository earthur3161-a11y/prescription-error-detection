import type { Batch, BatchStatus, Drug, PharmacySettings } from "../types";

function daysUntil(dateIso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateIso);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/**
 * The batch's effective status. Recall is a manual, sticky flag; expired and
 * near-expiry are derived from the expiry date and the configured window so
 * they can't drift out of date. This is the single source of truth for both
 * the inventory views and FEFO exclusion.
 */
export function effectiveBatchStatus(batch: Batch, nearExpiryDays: number): BatchStatus {
  if (batch.status === "recalled") return "recalled";
  const days = daysUntil(batch.expiryDate);
  if (days < 0) return "expired";
  if (days <= nearExpiryDays) return "near_expiry";
  return "active";
}

export function isExpired(batch: Batch): boolean {
  return daysUntil(batch.expiryDate) < 0;
}

/** A batch can be dispensed only if it isn't expired, isn't recalled, and has stock. */
export function isDispensable(batch: Batch, nearExpiryDays: number): boolean {
  const status = effectiveBatchStatus(batch, nearExpiryDays);
  return status !== "expired" && status !== "recalled" && batch.quantityRemaining > 0;
}

/**
 * First-Expiry-First-Out: of the dispensable batches for a drug, the one with
 * the nearest expiry date. Expired/recalled/empty batches are never suggested.
 */
export function suggestFefoBatch(batches: Batch[], nearExpiryDays: number): Batch | null {
  const dispensable = batches
    .filter((b) => isDispensable(b, nearExpiryDays))
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  return dispensable[0] ?? null;
}

export function totalDispensableStock(batches: Batch[], nearExpiryDays: number): number {
  return batches
    .filter((b) => isDispensable(b, nearExpiryDays))
    .reduce((sum, b) => sum + b.quantityRemaining, 0);
}

export function lowStockThresholdFor(drugId: string, settings: PharmacySettings): number {
  return settings.perDrugLowStock[drugId] ?? settings.defaultLowStockThreshold;
}

export interface DrugStockSummary {
  drug: Drug;
  batches: Batch[];
  totalOnHand: number;
  dispensable: number;
  lowStock: boolean;
  nearExpiryCount: number;
  expiredCount: number;
  threshold: number;
}

export function summariseStock(
  drugs: Drug[],
  batches: Batch[],
  settings: PharmacySettings
): DrugStockSummary[] {
  const byDrug = new Map<string, Batch[]>();
  for (const b of batches) {
    const list = byDrug.get(b.drugId) ?? [];
    list.push(b);
    byDrug.set(b.drugId, list);
  }

  const summaries: DrugStockSummary[] = [];
  for (const [drugId, drugBatches] of byDrug) {
    const drug = drugs.find((d) => d.id === drugId);
    if (!drug) continue;
    const threshold = lowStockThresholdFor(drugId, settings);
    const dispensable = totalDispensableStock(drugBatches, settings.nearExpiryDays);
    const totalOnHand = drugBatches.reduce((s, b) => s + b.quantityRemaining, 0);
    summaries.push({
      drug,
      batches: drugBatches,
      totalOnHand,
      dispensable,
      lowStock: dispensable < threshold,
      nearExpiryCount: drugBatches.filter((b) => effectiveBatchStatus(b, settings.nearExpiryDays) === "near_expiry").length,
      expiredCount: drugBatches.filter((b) => effectiveBatchStatus(b, settings.nearExpiryDays) === "expired").length,
      threshold,
    });
  }
  return summaries.sort((a, b) => a.drug.generic_name.localeCompare(b.drug.generic_name));
}
