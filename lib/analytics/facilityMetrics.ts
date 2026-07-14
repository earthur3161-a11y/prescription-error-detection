// Facility analytics — pure aggregation over the same append-only stores the
// rest of the app writes to. Turns raw screenings/decisions into the trend and
// rate metrics a Facility Admin uses for oversight: screening volume over time,
// verdict mix, flag-type and drug hotspots, override rate, EML-compliance
// trajectory, and pharmacist decision/intervention outcomes.

import { FLAG_TYPE_LABEL } from "../screening-engine/findings";
import type { FlagType, Verdict } from "../screening-engine/types";
import type { Drug, OverrideLog, PatientCheck, PharmacistAction, PharmacistActionType, Prescription } from "../types";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  safe: number;
  caution: number;
  blocked: number;
}

export interface LabeledCount {
  key: string;
  label: string;
  count: number;
}

export interface FacilityMetrics {
  totalScreenings: number; // prescriptions + patient self-checks
  totalLines: number;
  verdictCounts: Record<Verdict, number>;
  flaggedRate: number; // (caution+blocked) / lines, 0..1
  overrideCount: number;
  overrideRate: number; // overrides / (caution+blocked lines), 0..1 (capped)
  emlCompliancePct: number; // % of prescriptions with NO non-EML drug
  daily: DailyPoint[];
  flagTypes: LabeledCount[];
  topFlaggedDrugs: LabeledCount[];
  pharmacistActions: LabeledCount[];
  interventions: { outcome: string; timestamp: string }[];
}

const PHARMACIST_ACTION_LABEL: Record<PharmacistActionType, string> = {
  approve: "Approved",
  dispense: "Dispensed",
  reject: "Rejected",
  hold: "Held",
  request_clarification: "Clarification requested",
  record_intervention: "Intervention recorded",
};

function emptyVerdicts(): Record<Verdict, number> {
  return { safe: 0, caution: 0, blocked: 0 };
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

/** Enumerates every calendar day from the earliest to the latest date present (inclusive), capped to `maxDays`. */
function enumerateDays(dates: string[], maxDays = 30): string[] {
  if (dates.length === 0) return [];
  const sorted = [...new Set(dates)].sort();
  const start = new Date(sorted[0] + "T00:00:00Z");
  const end = new Date(sorted[sorted.length - 1] + "T00:00:00Z");
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out.length > maxDays ? out.slice(out.length - maxDays) : out;
}

export interface MetricsSources {
  prescriptions: Prescription[];
  patientChecks: PatientCheck[];
  overrideLogs: OverrideLog[];
  pharmacistActions: PharmacistAction[];
}

export function buildFacilityMetrics(sources: MetricsSources, drugs: Drug[]): FacilityMetrics {
  const drugById = new Map(drugs.map((d) => [d.id, d]));
  const nonEmlDrugIds = new Set(
    drugs.filter((d) => d.onEssentialMedicinesList === false).map((d) => d.id)
  );

  const verdictCounts = emptyVerdicts();
  const flagTypeCounts = new Map<FlagType, number>();
  const drugFlagCounts = new Map<string, number>();

  // Per-day verdict buckets, keyed by the screening's creation date.
  const dailyMap = new Map<string, Record<Verdict, number>>();
  const bump = (date: string, verdict: Verdict) => {
    const rec = dailyMap.get(date) ?? emptyVerdicts();
    rec[verdict] += 1;
    dailyMap.set(date, rec);
  };

  const countLine = (
    date: string,
    verdict: Verdict,
    flags: { type: FlagType; relatedDrugId?: string }[],
    fallbackDrugId: string
  ) => {
    verdictCounts[verdict] += 1;
    bump(date, verdict);
    for (const f of flags) {
      flagTypeCounts.set(f.type, (flagTypeCounts.get(f.type) ?? 0) + 1);
      const drugId = f.relatedDrugId ?? fallbackDrugId;
      if (drugId) drugFlagCounts.set(drugId, (drugFlagCounts.get(drugId) ?? 0) + 1);
    }
  };

  for (const rx of sources.prescriptions) {
    const date = dayOf(rx.createdAt);
    for (const v of rx.verdicts) countLine(date, v.verdict, v.flags, v.drugId);
  }
  for (const check of sources.patientChecks) {
    const date = dayOf(check.createdAt);
    for (const v of check.verdicts) countLine(date, v.verdict, v.flags, v.drugId);
  }

  const totalLines = verdictCounts.safe + verdictCounts.caution + verdictCounts.blocked;
  const flaggedLines = verdictCounts.caution + verdictCounts.blocked;

  // EML compliance: share of prescriptions containing NO non-EML drug.
  const rxTotal = sources.prescriptions.length;
  const rxWithNonEml = sources.prescriptions.filter((rx) =>
    rx.drugs.some((line) => nonEmlDrugIds.has(line.drugId))
  ).length;
  const emlCompliancePct = rxTotal === 0 ? 100 : Math.round(((rxTotal - rxWithNonEml) / rxTotal) * 100);

  const allDates = [
    ...sources.prescriptions.map((r) => dayOf(r.createdAt)),
    ...sources.patientChecks.map((c) => dayOf(c.createdAt)),
  ];
  const daily: DailyPoint[] = enumerateDays(allDates).map((date) => {
    const rec = dailyMap.get(date) ?? emptyVerdicts();
    return { date, safe: rec.safe, caution: rec.caution, blocked: rec.blocked };
  });

  const flagTypes: LabeledCount[] = [...flagTypeCounts.entries()]
    .map(([type, count]) => ({ key: type, label: FLAG_TYPE_LABEL[type], count }))
    .sort((a, b) => b.count - a.count);

  const topFlaggedDrugs: LabeledCount[] = [...drugFlagCounts.entries()]
    .map(([drugId, count]) => ({
      key: drugId,
      label: drugById.get(drugId)?.generic_name ?? drugId,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const actionCounts = new Map<PharmacistActionType, number>();
  for (const a of sources.pharmacistActions) {
    actionCounts.set(a.action, (actionCounts.get(a.action) ?? 0) + 1);
  }
  const pharmacistActions: LabeledCount[] = (Object.keys(PHARMACIST_ACTION_LABEL) as PharmacistActionType[])
    .map((action) => ({ key: action, label: PHARMACIST_ACTION_LABEL[action], count: actionCounts.get(action) ?? 0 }))
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count);

  const interventions = sources.pharmacistActions
    .filter((a) => a.action === "record_intervention" && a.interventionOutcome)
    .map((a) => ({ outcome: a.interventionOutcome as string, timestamp: a.timestamp }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return {
    totalScreenings: sources.prescriptions.length + sources.patientChecks.length,
    totalLines,
    verdictCounts,
    flaggedRate: totalLines === 0 ? 0 : flaggedLines / totalLines,
    overrideCount: sources.overrideLogs.length,
    overrideRate: flaggedLines === 0 ? 0 : Math.min(1, sources.overrideLogs.length / flaggedLines),
    emlCompliancePct,
    daily,
    flagTypes,
    topFlaggedDrugs,
    pharmacistActions,
    interventions,
  };
}
