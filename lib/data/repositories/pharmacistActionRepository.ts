import { supabase } from "../../supabase/client";
import type { PharmacistActionRow } from "../../supabase/types";
import type { PharmacistAction } from "../../types";

function mapRow(row: PharmacistActionRow): PharmacistAction {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    pharmacistId: row.pharmacist_id,
    action: row.action,
    reason: row.reason ?? undefined,
    clarificationDrugId: row.clarification_drug_id ?? undefined,
    interventionOutcome: row.intervention_outcome ?? undefined,
    timestamp: row.timestamp,
  };
}

/**
 * The only write path for pharmacist actions — append-only (no update/delete
 * export, matching the append-only RLS on pharmacist_actions: see
 * 0030_pharmacist_actions.sql). Previously Dexie/IndexedDB, per-browser, so a
 * request_clarification action never reached the prescriber it was for; now
 * real Postgres, RLS-scoped the same way overrideLogRepository.ts's
 * appendOverrideLog is.
 */
export async function appendPharmacistAction(
  entry: Omit<PharmacistAction, "id" | "timestamp">
): Promise<PharmacistAction> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("pharmacist_actions")
    .insert({
      id,
      prescription_id: entry.prescriptionId,
      pharmacist_id: entry.pharmacistId,
      action: entry.action,
      reason: entry.reason ?? null,
      clarification_drug_id: entry.clarificationDrugId ?? null,
      intervention_outcome: entry.interventionOutcome ?? null,
      timestamp,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to log pharmacist action.");
  return mapRow(data);
}

export async function listActionsByPrescription(prescriptionId: string): Promise<PharmacistAction[]> {
  const { data, error } = await supabase
    .from("pharmacist_actions")
    .select("*")
    .eq("prescription_id", prescriptionId)
    .order("timestamp", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function listAllPharmacistActions(): Promise<PharmacistAction[]> {
  const { data, error } = await supabase
    .from("pharmacist_actions")
    .select("*")
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
