import { db, ensureSeeded } from "../db";
import type { PatientProfile } from "../../types";

const LOCAL_PROFILE_ID = "local" as const;

export async function getLocalPatientProfile(): Promise<PatientProfile | null> {
  await ensureSeeded();
  const profile = await db.patientProfile.get(LOCAL_PROFILE_ID);
  return profile ?? null;
}

export async function saveLocalPatientProfile(
  profile: Omit<PatientProfile, "id" | "updatedAt">
): Promise<PatientProfile> {
  await ensureSeeded();
  const full: PatientProfile = { ...profile, id: LOCAL_PROFILE_ID, updatedAt: new Date().toISOString() };
  await db.patientProfile.put(full);
  return full;
}

export async function clearLocalPatientProfile(): Promise<void> {
  await ensureSeeded();
  await db.patientProfile.delete(LOCAL_PROFILE_ID);
}
