import { supabase } from "../../supabase/client";
import type { DispenseRecordRow } from "../../supabase/types";
import type { DispenseRecord, Flag } from "../../types";

// Reads only — there is deliberately no create export here anymore. Writing
// a dispense_records row happens exclusively through POST
// /api/pharmacy/dispense, which re-screens server-side and calls the
// dispense_drug() RPC (service_role only, see supabase/migrations/0010).
// A repository-level "create" function that just inserted a row would
// reintroduce exactly the bypass this migration closed, so it's not offered.

function mapRow(row: DispenseRecordRow): DispenseRecord {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    patientId: row.patient_id,
    pharmacistId: row.pharmacist_id,
    batchId: row.batch_id,
    drugId: row.drug_id,
    drugName: row.drug_name,
    quantityDispensed: row.quantity_dispensed,
    dispensedAt: row.dispensed_at,
    partialDispenseReason: row.partial_dispense_reason ?? undefined,
    screeningVerdict: row.screening_verdict,
    screeningFlags: row.screening_flags as Flag[],
    screenedAt: row.screened_at,
    overrideNote: row.override_note ?? undefined,
  };
}

export async function listDispenseRecords(): Promise<DispenseRecord[]> {
  const { data, error } = await supabase.from("dispense_records").select("*").order("dispensed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function listDispenseRecordsByPatient(patientId: string): Promise<DispenseRecord[]> {
  const { data, error } = await supabase
    .from("dispense_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("dispensed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
