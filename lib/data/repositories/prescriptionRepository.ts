import { db, ensureSeeded } from "../db";
import type { Prescription, PrescriptionSource, PrescriptionStatus } from "../../types";

export interface PrescriptionFilters {
  patientId?: string;
  prescriberId?: string;
  status?: PrescriptionStatus;
  source?: PrescriptionSource;
}

export async function listPrescriptions(filters: PrescriptionFilters = {}): Promise<Prescription[]> {
  await ensureSeeded();
  let all = await db.prescriptions.toArray();
  if (filters.patientId) all = all.filter((p) => p.patientId === filters.patientId);
  if (filters.prescriberId) all = all.filter((p) => p.prescriberId === filters.prescriberId);
  if (filters.status) all = all.filter((p) => p.status === filters.status);
  if (filters.source) all = all.filter((p) => p.source === filters.source);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPrescriptionById(id: string): Promise<Prescription | null> {
  await ensureSeeded();
  const rx = await db.prescriptions.get(id);
  return rx ?? null;
}

export async function createPrescription(prescription: Prescription): Promise<Prescription> {
  await ensureSeeded();
  await db.prescriptions.put(prescription);
  return prescription;
}

export async function updatePrescriptionStatus(
  id: string,
  status: PrescriptionStatus,
  pharmacistNote?: string,
  adminNote?: string
): Promise<void> {
  await ensureSeeded();
  await db.prescriptions.update(id, {
    status,
    ...(pharmacistNote !== undefined ? { pharmacistNote } : {}),
    ...(adminNote !== undefined ? { adminNote } : {}),
  });
}

/** Attach/replace the pharmacist's free-text note without changing status. */
export async function updatePharmacistNote(id: string, pharmacistNote: string): Promise<void> {
  await ensureSeeded();
  await db.prescriptions.update(id, { pharmacistNote });
}
