import { describe, expect, it } from "vitest";
import {
  computeEmlUsageStats,
  computeReportingRates,
  toDailyPoints,
  toFlagTypeLabeledCounts,
  toTopFlaggedDrugs,
} from "../reportingMetrics";
import type { ReportingSummary } from "../../data/repositories/reportingRepository";
import type { Drug } from "../../types";

function summary(overrides: Partial<ReportingSummary> = {}): ReportingSummary {
  return {
    totalPrescriptions: 0,
    totalLines: 0,
    safeLines: 0,
    cautionLines: 0,
    blockedLines: 0,
    overrideCount: 0,
    ...overrides,
  };
}

function drug(overrides: Partial<Drug> = {}): Drug {
  return {
    id: "drug_amoxicillin",
    generic_name: "Amoxicillin",
    brand_names: [],
    class: "Antibiotic",
    standard_dose_range: { minMgPerDose: 250, maxMgPerDose: 500, maxMgPerDay: 1500, frequency: "TID", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    onEssentialMedicinesList: true,
    ...overrides,
  };
}

describe("computeReportingRates", () => {
  it("returns 0/0 when there are no lines at all (not NaN or divide-by-zero)", () => {
    expect(computeReportingRates(summary())).toEqual({ flaggedRate: 0, overrideRate: 0 });
  });

  it("computes flaggedRate as (caution+blocked)/totalLines, overrideRate as overrides/flaggedLines", () => {
    const s = summary({ totalLines: 10, safeLines: 6, cautionLines: 3, blockedLines: 1, overrideCount: 2 });
    const rates = computeReportingRates(s);
    expect(rates.flaggedRate).toBeCloseTo(0.4); // (3+1)/10
    expect(rates.overrideRate).toBeCloseTo(0.5); // 2/4
  });

  it("caps overrideRate at 1 even if override_count somehow exceeds flagged lines", () => {
    const s = summary({ totalLines: 10, safeLines: 9, cautionLines: 1, blockedLines: 0, overrideCount: 5 });
    expect(computeReportingRates(s).overrideRate).toBe(1);
  });
});

describe("toDailyPoints", () => {
  it("maps the RPC's snake_case-derived fields to DailyPoint shape", () => {
    const points = toDailyPoints([{ day: "2026-07-01", safeCount: 4, cautionCount: 1, blockedCount: 0 }]);
    expect(points).toEqual([{ date: "2026-07-01", safe: 4, caution: 1, blocked: 0 }]);
  });
});

describe("toFlagTypeLabeledCounts", () => {
  it("resolves a known flag type to its human label", () => {
    const [item] = toFlagTypeLabeledCounts([{ flagType: "allergy", count: 3 }]);
    expect(item.key).toBe("allergy");
    expect(item.label).not.toBe("allergy"); // resolved to a human label, not the raw code
    expect(item.count).toBe(3);
  });

  it("falls back to the raw code for an unrecognized flag type rather than throwing", () => {
    const [item] = toFlagTypeLabeledCounts([{ flagType: "totally_made_up", count: 1 }]);
    expect(item.label).toBe("totally_made_up");
  });
});

describe("toTopFlaggedDrugs", () => {
  it("excludes drugs with zero flagged lines, sorts by flaggedCount desc, resolves generic_name", () => {
    const drugs = [drug({ id: "drug_a", generic_name: "Alpha" }), drug({ id: "drug_b", generic_name: "Beta" })];
    const rows = [
      { drugId: "drug_a", timesPrescribed: 10, flaggedCount: 2 },
      { drugId: "drug_b", timesPrescribed: 5, flaggedCount: 5 },
      { drugId: "drug_c", timesPrescribed: 3, flaggedCount: 0 }, // never flagged — excluded
    ];
    const result = toTopFlaggedDrugs(rows, drugs);
    expect(result.map((r) => r.key)).toEqual(["drug_b", "drug_a"]);
    expect(result[0].label).toBe("Beta");
  });

  it("respects the limit parameter", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      drugId: `drug_${i}`,
      timesPrescribed: 1,
      flaggedCount: i + 1,
    }));
    expect(toTopFlaggedDrugs(rows, [], 3)).toHaveLength(3);
  });
});

describe("computeEmlUsageStats", () => {
  it("returns 100% when there are no prescribed lines at all", () => {
    expect(computeEmlUsageStats([], [])).toEqual({ percent: 100, nonEmlDrugLines: 0, totalDrugLines: 0 });
  });

  it("weights the percentage by line volume, not by distinct drug count", () => {
    const drugs = [
      drug({ id: "drug_on_eml", onEssentialMedicinesList: true }),
      drug({ id: "drug_off_eml", onEssentialMedicinesList: false }),
    ];
    // One heavily-prescribed on-EML drug should dominate a rarely-prescribed off-EML one.
    const rows = [
      { drugId: "drug_on_eml", timesPrescribed: 90, flaggedCount: 0 },
      { drugId: "drug_off_eml", timesPrescribed: 10, flaggedCount: 0 },
    ];
    const stats = computeEmlUsageStats(rows, drugs);
    expect(stats.totalDrugLines).toBe(100);
    expect(stats.nonEmlDrugLines).toBe(10);
    expect(stats.percent).toBe(90);
  });

  it("treats a drugId absent from the formulary as on-EML (not penalized) rather than throwing", () => {
    const stats = computeEmlUsageStats([{ drugId: "drug_unknown", timesPrescribed: 5, flaggedCount: 0 }], []);
    expect(stats.percent).toBe(100);
  });
});
