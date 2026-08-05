import { supabase } from "../../supabase/client";
import type { PatientFeedbackReportRow } from "../../supabase/types";
import type { PatientFeedbackReport } from "../../types";

function mapRow(row: PatientFeedbackReportRow): PatientFeedbackReport {
  return {
    id: row.id,
    patientCheckId: row.patient_check_id ?? undefined,
    message: row.message,
    createdAt: row.created_at,
  };
}

/**
 * The only way an anonymous caller creates a patient_feedback_reports row —
 * there is no anon INSERT policy on the table itself (0024_patient_feedback_
 * reports.sql), so create_patient_feedback_report (security definer) is the
 * only path in, same "narrow RPC only" posture as create_patient_check_with_
 * quota.
 */
export async function createPatientFeedbackReport(
  entry: Omit<PatientFeedbackReport, "id" | "createdAt">
): Promise<PatientFeedbackReport> {
  const { data, error } = await supabase.rpc("create_patient_feedback_report", {
    p_patient_check_id: entry.patientCheckId ?? null,
    p_message: entry.message,
  });
  if (error) throw error;
  return mapRow(data);
}

/** Broad, authenticated-only read of every report — the admin audit-log page. */
export async function listPatientFeedbackReports(): Promise<PatientFeedbackReport[]> {
  const { data, error } = await supabase
    .from("patient_feedback_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
