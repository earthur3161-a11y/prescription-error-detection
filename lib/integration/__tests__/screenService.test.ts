import { describe, expect, it, vi } from "vitest";

// runScreen/screenRequestSchema are pure — no DB access — but the module
// also exports authorizeApiKey, which imports the service-role Supabase
// client at module load time. That client throws immediately if real
// credentials aren't present in the environment (correct in production;
// Vitest doesn't load .env.local the way Next's dev/build process does).
// Stubbed here so the module can load without needing real secrets, since
// nothing in this file exercises authorizeApiKey.
vi.mock("../../supabase/serviceClient", () => ({ supabaseService: {} }));

const { runScreen, screenRequestSchema } = await import("../screenService");

function buildRequest(overrides: Partial<Parameters<typeof screenRequestSchema.parse>[0]> = {}) {
  return screenRequestSchema.parse({
    patient: null,
    drug: { drugId: "drug_diazepam", doseMg: 5, frequencyPerDay: 2, durationDays: 5, route: "oral" },
    otherDrugs: [],
    ...overrides,
  });
}

describe("runScreen / toPatient", () => {
  it("returns null for an unrecognized drugId (pre-validated before the engine ever runs)", () => {
    const result = runScreen(buildRequest({ drug: { drugId: "drug_not_real", doseMg: 1, frequencyPerDay: 1 } }));
    expect(result).toBeNull();
  });

  it("flags age unknown, not a fabricated confident age, when dob is omitted on a geriatric-caution drug", () => {
    const withDob = runScreen(
      buildRequest({ patient: { dob: "1990-01-01", renalStatus: "normal", hepaticStatus: "normal" } })
    );
    expect(withDob).not.toBeNull();
    expect(withDob!.verdict.flags.some((f) => f.code === "AGE_DATA_UNKNOWN")).toBe(false);

    const dobOmitted = runScreen(
      buildRequest({ patient: { renalStatus: "normal", hepaticStatus: "normal" } })
    );
    expect(dobOmitted).not.toBeNull();
    expect(dobOmitted!.verdict.flags.some((f) => f.code === "AGE_DATA_UNKNOWN")).toBe(true);
    expect(dobOmitted!.verdict.verdict).not.toBe("safe");
  });

  it("an omitted dob does not silently resolve as a specific confirmed age (e.g. the old fabricated 1970 birth year)", () => {
    // Before the fix, an omitted dob defaulted to "1970-01-01" — a
    // ~56-year-old — which would itself trigger GERIATRIC_CAUTION_CLASS
    // (confident, wrong, and coincidentally still "not safe" for this drug,
    // which is exactly why this needs its own dedicated assertion rather
    // than just checking verdict !== "safe": the *fabricated-age* flag must
    // never appear, only the *unknown-age* one).
    const result = runScreen(buildRequest({ patient: { renalStatus: "normal", hepaticStatus: "normal" } }));
    expect(result!.verdict.flags.some((f) => f.code === "GERIATRIC_CAUTION_CLASS")).toBe(false);
    expect(result!.verdict.flags.some((f) => f.code === "AGE_DATA_UNKNOWN")).toBe(true);
  });

  it("a null patient (entirely omitted) still screens without throwing, patient-not-selected flag present", () => {
    const result = runScreen(buildRequest({ patient: null }));
    expect(result).not.toBeNull();
    expect(result!.verdict.flags.some((f) => f.code === "PATIENT_NOT_SELECTED")).toBe(true);
  });
});
