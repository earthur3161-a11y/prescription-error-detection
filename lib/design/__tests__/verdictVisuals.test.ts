import { describe, expect, it } from "vitest";
import {
  COMPACT_ICON_SAFE_SHAPES,
  getVerdictBasis,
  getVerdictColorToken,
  getVerdictShape,
} from "../verdictVisuals";
import type { Flag } from "../../screening-engine";

function flag(overrides: Partial<Flag> = {}): Flag {
  return {
    type: "data_incomplete",
    code: "DEMO",
    severity: "minor",
    message: "demo",
    audience_variant: { clinical: "demo", patient: "demo" },
    ...overrides,
  };
}

describe("getVerdictBasis", () => {
  it("is always 'confirmed' for safe, regardless of flags passed in", () => {
    expect(getVerdictBasis("safe", [])).toBe("confirmed");
    expect(getVerdictBasis("safe", [flag({ severity: "unknown" })])).toBe("confirmed");
  });

  it("is 'confirmed' for a caution/blocked with only real (non-unknown) flags", () => {
    expect(getVerdictBasis("caution", [flag({ severity: "moderate" })])).toBe("confirmed");
    expect(getVerdictBasis("blocked", [flag({ severity: "severe" })])).toBe("confirmed");
  });

  it("is 'unknown-only' when every relevant flag is unknown-severity", () => {
    expect(getVerdictBasis("caution", [flag({ severity: "unknown" })])).toBe("unknown-only");
    expect(
      getVerdictBasis("caution", [flag({ severity: "unknown" }), flag({ severity: "unknown", code: "OTHER" })])
    ).toBe("unknown-only");
  });

  it("is 'mixed' when both a real finding and an unknown flag are present", () => {
    expect(getVerdictBasis("caution", [flag({ severity: "moderate" }), flag({ severity: "unknown" })])).toBe("mixed");
  });

  it("ignores severity 'none' flags when deciding basis — they're informational, not verdict-driving", () => {
    expect(getVerdictBasis("caution", [flag({ severity: "none" }), flag({ severity: "unknown" })])).toBe(
      "unknown-only"
    );
  });

  it("defaults to 'confirmed' for caution/blocked with no flags at all (no basis info available)", () => {
    expect(getVerdictBasis("caution", [])).toBe("confirmed");
  });
});

describe("getVerdictShape / getVerdictColorToken", () => {
  it("safe is always the seal, regardless of basis", () => {
    expect(getVerdictShape("safe", "confirmed")).toBe("seal");
    expect(getVerdictColorToken("safe", "confirmed")).toBe("safe");
  });

  it("a confirmed caution is the solid triangle in caution tone", () => {
    expect(getVerdictShape("caution", "confirmed")).toBe("triangle");
    expect(getVerdictColorToken("caution", "confirmed")).toBe("caution");
  });

  it("an unknown-only caution is the open ring in unknown tone — never the triangle", () => {
    expect(getVerdictShape("caution", "unknown-only")).toBe("ring");
    expect(getVerdictColorToken("caution", "unknown-only")).toBe("unknown");
  });

  it("a mixed caution keeps the real triangle shape, not the ring", () => {
    expect(getVerdictShape("caution", "mixed")).toBe("triangle");
    expect(getVerdictColorToken("caution", "mixed")).toBe("caution");
  });

  it("blocked is always the octagon in blocked tone, regardless of basis (unknown alone never floors this far)", () => {
    expect(getVerdictShape("blocked", "confirmed")).toBe("octagon");
    expect(getVerdictShape("blocked", "mixed")).toBe("octagon");
    expect(getVerdictColorToken("blocked", "mixed")).toBe("blocked");
  });
});

describe("COMPACT_ICON_SAFE_SHAPES", () => {
  it("excludes triangle and octagon — confirmed via the deuteranopia ΔE margin, not a style preference", () => {
    expect(COMPACT_ICON_SAFE_SHAPES.has("triangle")).toBe(false);
    expect(COMPACT_ICON_SAFE_SHAPES.has("octagon")).toBe(false);
  });

  it("includes seal, ring, and dot", () => {
    expect(COMPACT_ICON_SAFE_SHAPES.has("seal")).toBe(true);
    expect(COMPACT_ICON_SAFE_SHAPES.has("ring")).toBe(true);
    expect(COMPACT_ICON_SAFE_SHAPES.has("dot")).toBe(true);
  });
});
