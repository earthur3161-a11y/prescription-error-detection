// Reporting module (item 6) — thin wrappers over the get_reporting_* RPCs
// (0019_reporting_module.sql). Every RPC scopes itself server-side from the
// caller's own JWT claims (institution-wide for admin/pharmacist at an
// institution, own-uid otherwise) — this layer never passes an institution_id
// or user_id of its own, matching the RPC's own security model.

import { supabase } from "../../supabase/client";

export interface ReportingRange {
  from?: string; // YYYY-MM-DD, inclusive. Omit for the RPC's own default (last 30 days).
  to?: string; // YYYY-MM-DD, inclusive.
}

export interface ReportingSummary {
  totalPrescriptions: number;
  totalLines: number;
  safeLines: number;
  cautionLines: number;
  blockedLines: number;
  overrideCount: number;
}

export interface ReportingDailyPoint {
  day: string;
  safeCount: number;
  cautionCount: number;
  blockedCount: number;
}

export interface ReportingDrugUsage {
  drugId: string;
  timesPrescribed: number;
  flaggedCount: number;
}

export interface ReportingFlagTypeCount {
  flagType: string;
  count: number;
}

export interface ReportingPrescriberPerformance {
  prescriberId: string;
  prescriberName: string;
  totalLines: number;
  flaggedLines: number;
  overrideCount: number;
}

function args(range: ReportingRange) {
  return { p_from: range.from, p_to: range.to };
}

export async function getReportingSummary(range: ReportingRange = {}): Promise<ReportingSummary> {
  const { data, error } = await supabase.rpc("get_reporting_summary", args(range));
  if (error) throw error;
  const row = data?.[0];
  return {
    totalPrescriptions: row?.total_prescriptions ?? 0,
    totalLines: row?.total_lines ?? 0,
    safeLines: row?.safe_lines ?? 0,
    cautionLines: row?.caution_lines ?? 0,
    blockedLines: row?.blocked_lines ?? 0,
    overrideCount: row?.override_count ?? 0,
  };
}

export async function getReportingDailyTrend(range: ReportingRange = {}): Promise<ReportingDailyPoint[]> {
  const { data, error } = await supabase.rpc("get_reporting_daily_trend", args(range));
  if (error) throw error;
  return (data ?? []).map((row) => ({
    day: row.day,
    safeCount: row.safe_count,
    cautionCount: row.caution_count,
    blockedCount: row.blocked_count,
  }));
}

export async function getReportingDrugUsage(range: ReportingRange = {}): Promise<ReportingDrugUsage[]> {
  const { data, error } = await supabase.rpc("get_reporting_drug_usage", args(range));
  if (error) throw error;
  return (data ?? []).map((row) => ({
    drugId: row.drug_id,
    timesPrescribed: row.times_prescribed,
    flaggedCount: row.flagged_count,
  }));
}

export async function getReportingFlagTypes(range: ReportingRange = {}): Promise<ReportingFlagTypeCount[]> {
  const { data, error } = await supabase.rpc("get_reporting_flag_types", args(range));
  if (error) throw error;
  return (data ?? []).map((row) => ({ flagType: row.flag_type, count: row.count }));
}

/** Institution-wide only (admin/pharmacist at an institution) — the RPC rejects any other caller. */
export async function getReportingPrescriberPerformance(
  range: ReportingRange = {}
): Promise<ReportingPrescriberPerformance[]> {
  const { data, error } = await supabase.rpc("get_reporting_prescriber_performance", args(range));
  if (error) throw error;
  return (data ?? []).map((row) => ({
    prescriberId: row.prescriber_id,
    prescriberName: row.prescriber_name,
    totalLines: row.total_lines,
    flaggedLines: row.flagged_lines,
    overrideCount: row.override_count,
  }));
}
