import { describe, expect, it } from "vitest";
import { mergeCustomDrugs } from "../mergeCustomDrugs";
import { getBaseFormularyBundle } from "../index";
import type { Drug } from "../../types";

function makeCustomDrug(overrides: Partial<Drug> = {}): Drug {
  return {
    id: "drug_zztest_custom",
    generic_name: "ZZTEST Custom Drug",
    brand_names: [],
    class: "Test class",
    standard_dose_range: { minMgPerDose: 100, maxMgPerDose: 500, maxMgPerDay: 1000, frequency: "once daily", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    onEssentialMedicinesList: false,
    ...overrides,
  };
}

describe("mergeCustomDrugs", () => {
  it("appends a custom drug to the base formulary's drug list, leaving the base list itself untouched", () => {
    const base = getBaseFormularyBundle("GH");
    const baseCount = base.drugs.length;
    const custom = makeCustomDrug();

    const merged = mergeCustomDrugs(base, [custom]);

    expect(merged.drugs.length).toBe(baseCount + 1);
    expect(merged.drugs.find((d) => d.id === custom.id)).toEqual(custom);
    expect(base.drugs.length).toBe(baseCount);
    expect(base.drugs.find((d) => d.id === custom.id)).toBeUndefined();
  });

  it("never mutates the base drugs array or its other rule arrays", () => {
    const base = getBaseFormularyBundle("GH");
    const merged = mergeCustomDrugs(base, [makeCustomDrug()]);

    expect(merged.interactionRules).toBe(base.interactionRules);
    expect(merged.allergyRules).toBe(base.allergyRules);
    expect(merged.foodInteractionRules).toBe(base.foodInteractionRules);
    expect(merged.alcoholInteractionRules).toBe(base.alcoholInteractionRules);
  });

  it("excludes a custom drug not marked available in the requested region", () => {
    const base = getBaseFormularyBundle("GH");
    const custom = makeCustomDrug({ region_availability: ["NG"] });

    const merged = mergeCustomDrugs(base, [custom]);

    expect(merged.drugs.find((d) => d.id === custom.id)).toBeUndefined();
  });

  it("returns the exact same base object (no-op) when there are no custom drugs", () => {
    const base = getBaseFormularyBundle("GH");
    expect(mergeCustomDrugs(base, [])).toBe(base);
  });

  it("merges multiple custom drugs at once", () => {
    const base = getBaseFormularyBundle("GH");
    const a = makeCustomDrug({ id: "drug_zztest_a", generic_name: "ZZTEST A" });
    const b = makeCustomDrug({ id: "drug_zztest_b", generic_name: "ZZTEST B" });

    const merged = mergeCustomDrugs(base, [a, b]);

    expect(merged.drugs.find((d) => d.id === "drug_zztest_a")).toBeTruthy();
    expect(merged.drugs.find((d) => d.id === "drug_zztest_b")).toBeTruthy();
  });
});
