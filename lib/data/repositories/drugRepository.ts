import Fuse from "fuse.js";
import { db, ensureSeeded } from "../db";
import type { Drug, FormularyBundle } from "../../types";
import { DEFAULT_REGION } from "../../formulary";

/**
 * Reads the formulary bundle from the local IndexedDB cache (not the static
 * source arrays) so this genuinely exercises the offline-cache path the
 * screening engine depends on.
 */
export async function getCachedFormularyBundle(
  region: string = DEFAULT_REGION
): Promise<FormularyBundle> {
  await ensureSeeded();
  const [drugs, interactionRules, allergyRules] = await Promise.all([
    db.drugs.toArray(),
    db.interactionRules.toArray(),
    db.allergyRules.toArray(),
  ]);
  return { region, drugs, interactionRules, allergyRules };
}

export async function searchDrugs(query: string): Promise<Drug[]> {
  await ensureSeeded();
  const drugs = await db.drugs.toArray();
  const q = query.trim().toLowerCase();
  if (!q) return drugs.sort((a, b) => a.generic_name.localeCompare(b.generic_name));
  return drugs
    .filter(
      (d) =>
        d.generic_name.toLowerCase().includes(q) ||
        d.brand_names.some((b) => b.toLowerCase().includes(q))
    )
    .sort((a, b) => a.generic_name.localeCompare(b.generic_name));
}

/**
 * Typo-tolerant drug search for patient-facing UI, where users may misspell
 * a drug name or only remember the brand name. Uses Fuse.js fuzzy matching
 * instead of plain substring matching.
 */
export async function searchDrugsFuzzy(query: string): Promise<Drug[]> {
  await ensureSeeded();
  const drugs = await db.drugs.toArray();
  const q = query.trim();
  if (!q) return [];

  const fuse = new Fuse(drugs, {
    keys: [
      { name: "generic_name", weight: 0.7 },
      { name: "brand_names", weight: 0.3 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  });
  return fuse.search(q, { limit: 8 }).map((result) => result.item);
}

export async function getDrugById(id: string): Promise<Drug | null> {
  await ensureSeeded();
  const drug = await db.drugs.get(id);
  return drug ?? null;
}

export async function upsertDrug(drug: Drug): Promise<Drug> {
  await ensureSeeded();
  await db.drugs.put(drug);
  return drug;
}

export async function bulkUpsertDrugs(drugs: Drug[]): Promise<number> {
  await ensureSeeded();
  await db.drugs.bulkPut(drugs);
  return drugs.length;
}

export async function deleteDrug(id: string): Promise<void> {
  await ensureSeeded();
  await db.drugs.delete(id);
}
