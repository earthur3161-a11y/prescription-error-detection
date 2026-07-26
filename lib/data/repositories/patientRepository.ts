import { supabase } from "../../supabase/client";
import type { PatientRow } from "../../supabase/types";
import type { ActiveMedication, AllergyRecord, Patient } from "../../types";

function mapRow(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob,
    sex: row.sex,
    phone: row.phone ?? undefined,
    weightKg: row.weight_kg,
    renalStatus: row.renal_status,
    hepaticStatus: row.hepatic_status,
    allergies: row.allergies as AllergyRecord[] | null,
    activeMedications: row.active_medications as ActiveMedication[] | null,
    isPregnant: row.is_pregnant,
    ownerId: row.owner_id ?? undefined,
    institutionId: row.institution_id,
  };
}

export async function listPatients(): Promise<Patient[]> {
  const { data, error } = await supabase.from("patients").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * Full-table scan + client-side filter, same as the previous Dexie
 * implementation — clinic-scale patient counts make this fine, and it keeps
 * the fuzzy name/id/phone-digits matching behavior identical.
 */
export async function searchPatients(query: string): Promise<Patient[]> {
  const patients = await listPatients();
  const q = query.trim().toLowerCase();
  if (!q) return patients;
  const digits = q.replace(/\D/g, "");
  return patients.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (!!digits && (p.phone ?? "").replace(/\D/g, "").includes(digits))
  );
}

/**
 * institutionId must be the creator's own JWT claim (null for an independent
 * practitioner) — patients_insert_own's WITH CHECK (0012_institution_boundary.sql)
 * rejects any other value, so there's no way to spoof a different institution
 * here even if a caller tried.
 */
export async function createPatient(
  patient: Omit<Patient, "id" | "ownerId" | "institutionId">,
  ownerId: string,
  institutionId: string | null
): Promise<Patient> {
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      id,
      name: patient.name,
      dob: patient.dob,
      sex: patient.sex,
      phone: patient.phone ?? null,
      weight_kg: patient.weightKg,
      renal_status: patient.renalStatus,
      hepatic_status: patient.hepaticStatus,
      allergies: patient.allergies,
      active_medications: patient.activeMedications,
      is_pregnant: patient.isPregnant ?? null,
      owner_id: ownerId,
      institution_id: institutionId,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to create patient.");
  return mapRow(data);
}
