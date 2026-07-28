// Pure shaping layer between the reporting RPCs (server-scoped raw counts)
// and the chart components already used by the old facility metrics page
// (DailyPoint/LabeledCount) — kept separate from facilityMetrics.ts since the
// inputs are now pre-aggregated server-side, not raw record arrays.

import { FLAG_TYPE_LABEL } from "../screening-engine/findings";
import type { FlagType } from "../screening-engine/types";
import type { Drug } from "../types";
import type {
  ReportingDailyPoint,
  ReportingDrugUsage,
  ReportingFlagTypeCount,
  ReportingSummary,
} from "../data/repositories/reportingRepository";
import type { DailyPoint, LabeledCount } from "./facilityMetrics";

export interface ReportingRates {
  flaggedRate: number; // (caution+blocked) / lines, 0..1
  overrideRate: number; // overrides / (caution+blocked lines), 0..1 (capped)
}

export function computeReportingRates(summary: ReportingSummary): ReportingRates {
  const flaggedLines = summary.cautionLines + summary.blockedLines;
  return {
    flaggedRate: summary.totalLines === 0 ? 0 : flaggedLines / summary.totalLines,
    overrideRate: flaggedLines === 0 ? 0 : Math.min(1, summary.overrideCount / flaggedLines),
  };
}

export function toDailyPoints(rows: ReportingDailyPoint[]): DailyPoint[] {
  return rows.map((r) => ({ date: r.day, safe: r.safeCount, caution: r.cautionCount, blocked: r.blockedCount }));
}

export function toFlagTypeLabeledCounts(rows: ReportingFlagTypeCount[]): LabeledCount[] {
  return rows.map((r) => ({
    key: r.flagType,
    label: FLAG_TYPE_LABEL[r.flagType as FlagType] ?? r.flagType,
    count: r.count,
  }));
}

/** Top flagged drugs by generic name — drugs with zero flagged lines are excluded, same as the old client-side aggregation. */
export function toTopFlaggedDrugs(rows: ReportingDrugUsage[], drugs: Drug[], limit = 6): LabeledCount[] {
  const drugById = new Map(drugs.map((d) => [d.id, d]));
  return rows
    .filter((r) => r.flaggedCount > 0)
    .map((r) => ({ key: r.drugId, label: drugById.get(r.drugId)?.generic_name ?? r.drugId, count: r.flaggedCount }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface EmlUsageStats {
  percent: number; // % of prescribed lines that ARE on the EML
  nonEmlDrugLines: number;
  totalDrugLines: number;
}

/** Line-level EML compliance from raw drug-usage counts — the formulary's on-EML flag is static/client-side, so this can't be computed in SQL. */
export function computeEmlUsageStats(rows: ReportingDrugUsage[], drugs: Drug[]): EmlUsageStats {
  const drugById = new Map(drugs.map((d) => [d.id, d]));
  let total = 0;
  let nonEml = 0;
  for (const r of rows) {
    total += r.timesPrescribed;
    if (drugById.get(r.drugId)?.onEssentialMedicinesList === false) nonEml += r.timesPrescribed;
  }
  return {
    percent: total === 0 ? 100 : Math.round(((total - nonEml) / total) * 100),
    nonEmlDrugLines: nonEml,
    totalDrugLines: total,
  };
}
