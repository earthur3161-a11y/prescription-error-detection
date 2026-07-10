import { db, ensureSeeded } from "../db";
import type { PatientCheck } from "../../types";

export async function createPatientCheck(check: PatientCheck): Promise<PatientCheck> {
  await ensureSeeded();
  await db.patientChecks.put(check);
  return check;
}

export async function getPatientCheckById(id: string): Promise<PatientCheck | null> {
  await ensureSeeded();
  const check = await db.patientChecks.get(id);
  return check ?? null;
}

export async function getPatientCheckByShareToken(shareToken: string): Promise<PatientCheck | null> {
  await ensureSeeded();
  const check = await db.patientChecks.where("shareToken").equals(shareToken).first();
  return check ?? null;
}

export async function listPatientChecks(): Promise<PatientCheck[]> {
  await ensureSeeded();
  const checks = await db.patientChecks.toArray();
  return checks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markPatientCheckPulled(id: string, prescriptionId: string): Promise<void> {
  await ensureSeeded();
  await db.patientChecks.update(id, { pulledIntoPrescriptionId: prescriptionId });
}
