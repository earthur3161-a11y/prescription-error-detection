import { db, ensureSeeded } from "../db";
import type { FacilityPolicy } from "../../types";

const DEFAULT_POLICY: FacilityPolicy = { id: "local", requireAdminCosignOnBlocked: true };

export async function getFacilityPolicy(): Promise<FacilityPolicy> {
  await ensureSeeded();
  const policy = await db.facilityPolicy.get("local");
  return policy ?? DEFAULT_POLICY;
}

export async function updateFacilityPolicy(patch: Partial<Omit<FacilityPolicy, "id">>): Promise<FacilityPolicy> {
  await ensureSeeded();
  const current = await getFacilityPolicy();
  const updated: FacilityPolicy = { ...current, ...patch };
  await db.facilityPolicy.put(updated);
  return updated;
}
