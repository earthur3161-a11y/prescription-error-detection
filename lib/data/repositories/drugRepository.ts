import Fuse from "fuse.js";
import { db, ensureSeeded } from "../db";
import { supabase } from "../../supabase/client";
import { mergeCustomDrugs } from "../../formulary/mergeCustomDrugs";
import type { CustomDrugRow } from "../../supabase/types";
import type { Drug, FormularyBundle } from "../../types";
import { DEFAULT_REGION } from "../../formulary";

/**
 * Admin-added custom drugs (0026_custom_drugs.sql) — fetched live from
 * Postgres, not cached in Dexie. The static base formulary needs to work
 * fully offline (real, supported prescribing scenario — see the outbox
 * pattern elsewhere in this app); custom drugs are a small, admin-added
 * layer on top of it that's only ever added from an online session, so
 * degrading to "just the base formulary" on a fetch failure (offline, or a
 * transient network error) is the correct, deliberate tradeoff rather than
 * taking on Dexie sync/staleness complexity for a rarely-changing, always-
 * online-context dataset.
 */
async function fetchCustomDrugs(): Promise<Drug[]> {
  try {
    const { data, error } = await supabase.from("custom_drugs").select("drug");
    if (error) throw error;
    return ((data ?? []) as Pick<CustomDrugRow, "drug">[]).map((row) => row.drug as Drug);
  } catch {
    return [];
  }
}

/**
 * Reads the formulary bundle from the local IndexedDB cache (not the static
 * source arrays) so this genuinely exercises the offline-cache path the
 * screening engine depends on — then layers live-fetched custom drugs on
 * top, so an admin's addition reaches every surface, not just their own
 * browser.
 */
export async function getCachedFormularyBundle(
  region: string = DEFAULT_REGION
): Promise<FormularyBundle> {
  await ensureSeeded();
  const [drugs, interactionRules, allergyRules, foodInteractionRules, alcoholInteractionRules, customDrugs] =
    await Promise.all([
      db.drugs.toArray(),
      db.interactionRules.toArray(),
      db.allergyRules.toArray(),
      db.foodInteractionRules.toArray(),
      db.alcoholInteractionRules.toArray(),
      fetchCustomDrugs(),
    ]);
  const base: FormularyBundle = { region, drugs, interactionRules, allergyRules, foodInteractionRules, alcoholInteractionRules };
  return mergeCustomDrugs(base, customDrugs);
}

export async function searchDrugs(query: string): Promise<Drug[]> {
  const { drugs } = await getCachedFormularyBundle();
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
  const { drugs } = await getCachedFormularyBundle();
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
  const { drugs } = await getCachedFormularyBundle();
  return drugs.find((d) => d.id === id) ?? null;
}

/**
 * Admin Formulary Management's "Add drug" / CSV-publish paths — both always
 * generate a fresh id (generateId("drug") / slugifyId(generic_name)) and
 * never revise an existing row, so a plain insert is correct here, not an
 * upsert: a genuine id collision should fail loudly (Postgres unique-
 * violation) rather than silently overwrite another admin's entry. Writes
 * only ever land in custom_drugs (0026) — the 144+ base Ghana STG/EML drugs
 * in lib/formulary/ghana/ are code-committed and immutable via this path,
 * by design.
 */
export async function upsertDrug(drug: Drug): Promise<Drug> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Not signed in.");
  const { error } = await supabase
    .from("custom_drugs")
    .insert({ id: drug.id, drug, owner_id: userData.user.id });
  if (error) throw error;
  return drug;
}

export async function bulkUpsertDrugs(drugs: Drug[]): Promise<number> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Not signed in.");
  const rows = drugs.map((drug) => ({ id: drug.id, drug, owner_id: userData.user.id }));
  const { error } = await supabase.from("custom_drugs").insert(rows);
  if (error) throw error;
  return drugs.length;
}

/**
 * Only ever removes a custom_drugs row — a base formulary drug's id was
 * never in this table to begin with, so RLS/the WHERE clause simply matches
 * nothing for one; the admin UI itself never offers a delete affordance for
 * a base drug (see app/(app)/admin/formulary/page.tsx), but this still
 * throws rather than silently no-op-succeeding if it's ever called with one
 * anyway, same "zero rows affected must be a real error" standard as
 * updatePrescriptionStatus/markPatientCheckPulled.
 */
export async function deleteDrug(id: string): Promise<void> {
  const { data, error } = await supabase.from("custom_drugs").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Couldn't remove this drug — it isn't a custom formulary entry, or you don't own it.");
  }
}
