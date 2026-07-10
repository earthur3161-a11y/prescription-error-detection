import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { PharmacistAction } from "../../types";

/**
 * The only write path for pharmacist actions — append-only, no update/delete,
 * so the audit trail behind the daily dispensing report is immutable.
 */
export async function appendPharmacistAction(
  entry: Omit<PharmacistAction, "id" | "timestamp">
): Promise<PharmacistAction> {
  await ensureSeeded();
  const action: PharmacistAction = {
    ...entry,
    id: generateId("pact"),
    timestamp: new Date().toISOString(),
  };
  await db.pharmacistActions.put(action);
  return action;
}

export async function listActionsByPrescription(prescriptionId: string): Promise<PharmacistAction[]> {
  await ensureSeeded();
  const all = await db.pharmacistActions.where("prescriptionId").equals(prescriptionId).toArray();
  return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export async function listAllPharmacistActions(): Promise<PharmacistAction[]> {
  await ensureSeeded();
  const all = await db.pharmacistActions.toArray();
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
