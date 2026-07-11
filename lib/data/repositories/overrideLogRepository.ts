import { supabase } from "../../supabase/client";
import type { OverrideLogRow } from "../../supabase/types";
import type { OverrideLog } from "../../types";

function mapRow(row: OverrideLogRow): OverrideLog {
  return {
    id: row.id,
    prescriptionId: row.prescription_id,
    drugId: row.drug_id,
    verdictOverridden: row.verdict_overridden,
    reasonCode: row.reason_code,
    reasonText: row.reason_text,
    userId: row.user_id,
    timestamp: row.timestamp,
  };
}

export interface OverrideLogFilters {
  prescriptionId?: string;
  userId?: string;
  from?: string;
  to?: string;
}

/**
 * The only write path for override logs. There is deliberately no update or
 * delete export here — once logged, an override is permanent, per the
 * append-only audit trail requirement (also enforced by RLS: no update/
 * delete policy exists on override_logs).
 */
export async function appendOverrideLog(
  entry: Omit<OverrideLog, "id" | "timestamp">
): Promise<OverrideLog> {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("override_logs")
    .insert({
      id,
      prescription_id: entry.prescriptionId,
      drug_id: entry.drugId,
      verdict_overridden: entry.verdictOverridden,
      reason_code: entry.reasonCode,
      reason_text: entry.reasonText,
      user_id: entry.userId,
      timestamp,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to log override.");
  return mapRow(data);
}

export async function listOverrideLogs(filters: OverrideLogFilters = {}): Promise<OverrideLog[]> {
  let query = supabase.from("override_logs").select("*");
  if (filters.prescriptionId) query = query.eq("prescription_id", filters.prescriptionId);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.from) query = query.gte("timestamp", filters.from);
  if (filters.to) query = query.lte("timestamp", filters.to);
  const { data, error } = await query.order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
