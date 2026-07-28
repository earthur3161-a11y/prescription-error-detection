"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getReportingDailyTrend,
  getReportingDrugUsage,
  getReportingFlagTypes,
  getReportingPrescriberPerformance,
  getReportingSummary,
  type ReportingRange,
} from "../../data/repositories/reportingRepository";

/**
 * The reporting RPCs (0019) scope themselves server-side from the caller's
 * own JWT claims — institution-wide for admin/pharmacist at an institution,
 * own-uid otherwise. This hook family never passes an institution/user id of
 * its own; `range` is the only client-controlled input.
 */
export function useReportingSummary(range: ReportingRange = {}) {
  return useQuery({
    queryKey: ["reportingSummary", range],
    queryFn: () => getReportingSummary(range),
  });
}

export function useReportingDailyTrend(range: ReportingRange = {}) {
  return useQuery({
    queryKey: ["reportingDailyTrend", range],
    queryFn: () => getReportingDailyTrend(range),
  });
}

export function useReportingDrugUsage(range: ReportingRange = {}) {
  return useQuery({
    queryKey: ["reportingDrugUsage", range],
    queryFn: () => getReportingDrugUsage(range),
  });
}

export function useReportingFlagTypes(range: ReportingRange = {}) {
  return useQuery({
    queryKey: ["reportingFlagTypes", range],
    queryFn: () => getReportingFlagTypes(range),
  });
}

/** Institution-wide only (admin/pharmacist at an institution) — the RPC rejects any other caller, so only call this where that's already true (e.g. /admin/analytics). */
export function useReportingPrescriberPerformance(range: ReportingRange = {}, enabled = true) {
  return useQuery({
    queryKey: ["reportingPrescriberPerformance", range],
    queryFn: () => getReportingPrescriberPerformance(range),
    enabled,
  });
}
