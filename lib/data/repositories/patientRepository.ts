import { db, ensureSeeded } from "../db";
import { generateId } from "../../utils/id";
import type { Patient } from "../../types";

export async function listPatients(): Promise<Patient[]> {
  await ensureSeeded();
  return db.patients.orderBy("name").toArray();
}

export async function getPatientById(id: string): Promise<Patient | null> {
  await ensureSeeded();
  const patient = await db.patients.get(id);
  return patient ?? null;
}

export async function searchPatients(query: string): Promise<Patient[]> {
  await ensureSeeded();
  const patients = await db.patients.toArray();
  const q = query.trim().toLowerCase();
  if (!q) return patients.sort((a, b) => a.name.localeCompare(b.name));
  const digits = q.replace(/\D/g, "");
  return patients
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (!!digits && (p.phone ?? "").replace(/\D/g, "").includes(digits))
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createPatient(patient: Omit<Patient, "id">): Promise<Patient> {
  await ensureSeeded();
  const full: Patient = { ...patient, id: generateId("patient") };
  await db.patients.put(full);
  return full;
}
