import { describe, expect, it } from "vitest";
import { getPatientGuidance } from "../guidance";

describe("getPatientGuidance", () => {
  it("always routes caution/blocked to a professional and never tells the patient to self-manage", () => {
    for (const verdict of ["caution", "blocked"] as const) {
      for (const basis of ["confirmed", "unknown-only", "mixed"] as const) {
        const guidance = getPatientGuidance(verdict, basis);
        const stepsText = guidance.steps.join(" ").toLowerCase();
        expect(stepsText).toMatch(/pharmacist|doctor|professional/);
      }
    }
  });

  it("defaults basis to 'confirmed' when the caller omits it", () => {
    expect(getPatientGuidance("caution")).toEqual(getPatientGuidance("caution", "confirmed"));
    expect(getPatientGuidance("blocked")).toEqual(getPatientGuidance("blocked", "confirmed"));
  });

  it("has no basisNote for safe, regardless of basis", () => {
    expect(getPatientGuidance("safe", "confirmed").basisNote).toBeUndefined();
    expect(getPatientGuidance("safe", "unknown-only").basisNote).toBeUndefined();
    expect(getPatientGuidance("safe", "mixed").basisNote).toBeUndefined();
  });

  it("has no basisNote for a fully confirmed caution or blocked result", () => {
    expect(getPatientGuidance("caution", "confirmed").basisNote).toBeUndefined();
    expect(getPatientGuidance("blocked", "confirmed").basisNote).toBeUndefined();
  });

  it("gives an unknown-only caution a reassuring note that explicitly says nothing was found wrong", () => {
    const note = getPatientGuidance("caution", "unknown-only").basisNote;
    expect(note).toBeDefined();
    expect(note!.toLowerCase()).toMatch(/didn't|don't have|not.*alarm|nothing.*wrong|missing/);
  });

  it("gives a mixed caution a note acknowledging both a real finding and missing information", () => {
    const note = getPatientGuidance("caution", "mixed").basisNote;
    expect(note).toBeDefined();
    expect(note!.toLowerCase()).toMatch(/did find/);
    expect(note!.toLowerCase()).toMatch(/missing|couldn't check/);
  });

  it("has no basisNote for blocked+unknown-only, since that combination is unreachable (unknown severity alone never floors to blocked)", () => {
    expect(getPatientGuidance("blocked", "unknown-only").basisNote).toBeUndefined();
  });

  it("gives a mixed blocked result a note that does NOT suggest resolving the missing info would change the advice", () => {
    const note = getPatientGuidance("blocked", "mixed").basisNote;
    expect(note).toBeDefined();
    expect(note!.toLowerCase()).toMatch(/professional first/);
  });

  it("every verdict returns at least one actionable step", () => {
    for (const verdict of ["safe", "caution", "blocked"] as const) {
      expect(getPatientGuidance(verdict).steps.length).toBeGreaterThan(0);
    }
  });
});
