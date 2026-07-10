import { db, ensureSeeded } from "../db";
import { DEFAULT_PHARMACY_SETTINGS } from "../seed/pharmacyInventory";
import type { PharmacySettings } from "../../types";

export async function getPharmacySettings(): Promise<PharmacySettings> {
  await ensureSeeded();
  return (await db.pharmacySettings.get("local")) ?? DEFAULT_PHARMACY_SETTINGS;
}

export async function updatePharmacySettings(
  patch: Partial<Omit<PharmacySettings, "id">>
): Promise<PharmacySettings> {
  await ensureSeeded();
  const current = await getPharmacySettings();
  const updated: PharmacySettings = { ...current, ...patch };
  await db.pharmacySettings.put(updated);
  return updated;
}
