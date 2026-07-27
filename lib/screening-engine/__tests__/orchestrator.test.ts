import { describe, expect, it } from "vitest";
import { getFormularyBundle } from "../../formulary";
import type { Patient, PrescriptionDrugLine } from "../../types";
import { screenDrugLine } from "../orchestrator";
import type { ScreeningInput } from "../types";

const formulary = getFormularyBundle("GH");

function makeLine(overrides: Partial<PrescriptionDrugLine> = {}): PrescriptionDrugLine {
  return {
    id: "line_1",
    drugId: "drug_paracetamol",
    form: "tablet",
    strengthMg: 500,
    route: "oral",
    doseMg: 500,
    frequencyPerDay: 3,
    durationDays: 5,
    ...overrides,
  };
}

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient_1",
    name: "Test Patient",
    dob: "1990-01-01",
    sex: "female",
    weightKg: 70,
    renalStatus: "normal",
    hepaticStatus: "normal",
    allergies: [],
    activeMedications: [],
    // Explicitly confirmed-negative, matching every other field above — a
    // "clean baseline" patient must be fully known-clean, not silently
    // undefined-and-therefore-unknown. Before the unknown-pregnancy fix this
    // gap was invisible (undefined behaved identically to false); now it
    // would otherwise leak a PREGNANCY_STATUS_UNKNOWN flag into every test
    // that doesn't care about pregnancy.
    isPregnant: false,
    ...overrides,
  };
}

function screen(input: Partial<ScreeningInput> & { drugLine: PrescriptionDrugLine }) {
  return screenDrugLine({
    patient: null,
    otherLines: [],
    formulary,
    ...input,
  });
}

describe("screenDrugLine", () => {
  it("returns safe with no flags for a clean patient and standard dose", () => {
    // drug_amoxicillin, not makeLine()'s own paracetamol default — paracetamol
    // now carries a real, sourced, unconditional alcohol-interaction flag
    // (alcoholInteractionRules.ts) that correctly floors it below "safe"
    // regardless of patient data, so it's no longer a valid "nothing at all
    // is wrong" baseline.
    const result = screen({ patient: makePatient(), drugLine: makeLine({ drugId: "drug_amoxicillin" }) });
    expect(result.verdict).toBe("safe");
    expect(result.flags).toHaveLength(0);
  });

  it("blocks on a severe direct allergy match", () => {
    const patient = makePatient({
      allergies: [{ allergen: "Penicillin", severity: "severe" }],
    });
    const result = screen({ patient, drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500 }) });
    expect(result.verdict).toBe("blocked");
    expect(result.flags.some((f) => f.code === "ALLERGY_DIRECT_MATCH")).toBe(true);
  });

  it("cautions on moderate cross-reactive allergy (penicillin -> cephalosporin)", () => {
    const patient = makePatient({
      allergies: [{ allergen: "Penicillin", severity: "moderate" }],
    });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_ceftriaxone", doseMg: 1000, frequencyPerDay: 1 }),
    });
    expect(result.verdict).toBe("caution");
    expect(result.flags.some((f) => f.code === "ALLERGY_CROSS_REACTIVE")).toBe(true);
  });

  it("blocks on a severe drug-drug interaction (warfarin + aspirin)", () => {
    const patient = makePatient({
      activeMedications: [{ drugId: "drug_warfarin", startedAt: "2024-01-01" }],
    });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_aspirin", doseMg: 300, frequencyPerDay: 1 }),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.flags.some((f) => f.code === "DRUG_DRUG_INTERACTION")).toBe(true);
  });

  it("flags duplicate therapy for two NSAIDs", () => {
    const line1 = makeLine({ id: "line_1", drugId: "drug_ibuprofen", doseMg: 400, frequencyPerDay: 3 });
    const line2 = makeLine({ id: "line_2", drugId: "drug_diclofenac", doseMg: 50, frequencyPerDay: 2 });
    const patient = makePatient();

    const result = screen({ patient, drugLine: line2, otherLines: [line1, line2] });
    expect(result.flags.some((f) => f.code === "DUPLICATE_THERAPEUTIC_CLASS")).toBe(true);
    expect(result.verdict).not.toBe("safe");
  });

  it("flags dose above the standard daily maximum", () => {
    const patient = makePatient();
    const result = screen({
      patient,
      drugLine: makeLine({ doseMg: 1000, frequencyPerDay: 6 }), // 6000mg/day > 4000mg max
    });
    expect(result.flags.some((f) => f.code === "DOSE_ABOVE_MAX_PER_DAY")).toBe(true);
    expect(result.verdict).toBe("blocked");
  });

  it("never resolves to safe when patient allergy data is unknown (null)", () => {
    const patient = makePatient({ allergies: null });
    const result = screen({ patient, drugLine: makeLine() });
    expect(result.verdict).not.toBe("safe");
    expect(result.flags.some((f) => f.severity === "unknown")).toBe(true);
  });

  it("never resolves to safe when active medication data is unknown (null)", () => {
    const patient = makePatient({ activeMedications: null });
    const result = screen({ patient, drugLine: makeLine() });
    expect(result.verdict).not.toBe("safe");
  });

  it("attributes unknown active-medication data to duplicate-therapy screening specifically, not just interaction/data-completeness", () => {
    // dataCompletenessCheck and interactionCheck both independently raise
    // MEDICATION_DATA_UNKNOWN for this same null case (defense in depth) —
    // duplicateTherapyCheck reads the identical field for a different
    // clinical question (duplicate class, not interactions) and must raise
    // its own copy too, rather than silently skipping duplicate-class
    // detection and letting the other two checks' flags stand in for it.
    const patient = makePatient({ activeMedications: null });
    const result = screen({ patient, drugLine: makeLine() });
    expect(
      result.flags.some((f) => f.code === "MEDICATION_DATA_UNKNOWN" && f.type === "duplicate_therapy")
    ).toBe(true);
    // The other two independent copies still fire too — this isn't a
    // replacement for them, just the missing third one.
    expect(
      result.flags.some((f) => f.code === "MEDICATION_DATA_UNKNOWN" && f.type === "data_incomplete")
    ).toBe(true);
    expect(
      result.flags.some((f) => f.code === "MEDICATION_DATA_UNKNOWN" && f.type === "interaction")
    ).toBe(true);
  });

  it("never resolves to safe when no patient is selected", () => {
    const result = screen({ patient: null, drugLine: makeLine() });
    expect(result.verdict).not.toBe("safe");
  });

  it("flags missing weight for weight-based drugs and never silently passes as safe", () => {
    const patient = makePatient({ weightKg: null });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500 }),
    });
    expect(result.flags.some((f) => f.code === "WEIGHT_DATA_UNKNOWN")).toBe(true);
    expect(result.verdict).not.toBe("safe");
  });

  it("flags pediatric dose above the weight-based maximum", () => {
    const patient = makePatient({
      dob: new Date(new Date().getFullYear() - 5, 0, 1).toISOString(),
      weightKg: 15,
    });
    // 15kg * 25mg/kg = 375mg max pediatric dose for amoxicillin
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500, frequencyPerDay: 2 }),
    });
    expect(result.flags.some((f) => f.code === "PEDIATRIC_DOSE_ABOVE_MAX")).toBe(true);
    expect(result.verdict).toBe("blocked");
  });

  it("treats an empty allergy/medication array as confirmed-none, not unknown", () => {
    const patient = makePatient({ allergies: [], activeMedications: [] });
    // drug_amoxicillin specifically: paracetamol (makeLine()'s own default)
    // now carries a real, sourced, unconditional alcohol-interaction flag
    // (see alcoholInteractionRules.ts) that would floor this below "safe"
    // for a reason unrelated to what this test actually checks.
    const result = screen({ patient, drugLine: makeLine({ drugId: "drug_amoxicillin" }) });
    expect(result.flags.some((f) => f.severity === "unknown")).toBe(false);
    expect(result.verdict).toBe("safe");
  });

  it("cautions and suggests an alternative for a drug not on the Ghana EML", () => {
    const patient = makePatient();
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_loratadine", doseMg: 10, frequencyPerDay: 1 }),
    });
    const emlFlag = result.flags.find((f) => f.code === "NOT_ON_EML");
    expect(emlFlag).toBeDefined();
    expect(emlFlag?.audience_variant.clinical).toContain("Cetirizine");
    expect(result.verdict).toBe("caution");
  });

  it("does not flag EML status for a drug that is on the list", () => {
    const patient = makePatient();
    const result = screen({ patient, drugLine: makeLine({ drugId: "drug_paracetamol" }) });
    expect(result.flags.some((f) => f.code === "NOT_ON_EML")).toBe(false);
  });

  it("blocks on an ACE-inhibitor + potassium-sparing diuretic hyperkalaemia interaction", () => {
    const patient = makePatient({
      activeMedications: [{ drugId: "drug_spironolactone", startedAt: "2024-01-01" }],
    });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_lisinopril", doseMg: 10, frequencyPerDay: 1 }),
    });
    expect(result.verdict).toBe("blocked");
    expect(result.flags.some((f) => f.code === "DRUG_DRUG_INTERACTION")).toBe(true);
  });

  it("flags duplicate therapy across two macrolides from the expanded formulary", () => {
    const line1 = makeLine({ id: "line_1", drugId: "drug_azithromycin", doseMg: 500, frequencyPerDay: 1 });
    const line2 = makeLine({ id: "line_2", drugId: "drug_clarithromycin", doseMg: 500, frequencyPerDay: 2 });
    const result = screen({ patient: makePatient(), drugLine: line2, otherLines: [line1, line2] });
    expect(result.flags.some((f) => f.code === "DUPLICATE_THERAPEUTIC_CLASS")).toBe(true);
  });

  it("applies penicillin->cephalosporin cross-reactivity to an expanded-formulary cephalosporin", () => {
    const patient = makePatient({ allergies: [{ allergen: "Penicillin", severity: "severe" }] });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_cefuroxime", doseMg: 500, frequencyPerDay: 2 }),
    });
    expect(result.flags.some((f) => f.code === "ALLERGY_CROSS_REACTIVE")).toBe(true);
    expect(result.verdict).not.toBe("safe");
  });

  it("produces both patient and clinical audience variants for every flag (parity guarantee)", () => {
    const patient = makePatient({ allergies: [{ allergen: "Penicillin", severity: "severe" }] });
    const result = screen({ patient, drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500 }) });
    expect(result.flags.length).toBeGreaterThan(0);
    for (const flag of result.flags) {
      expect(flag.audience_variant.patient.length).toBeGreaterThan(0);
      expect(flag.audience_variant.clinical.length).toBeGreaterThan(0);
      expect(flag.type).toBeTruthy();
    }
  });

  it("raises a distinct pregnancy_warning for a pregnancy-contraindicated drug", () => {
    const patient = makePatient({ isPregnant: true });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_doxycycline", doseMg: 100, frequencyPerDay: 1 }),
    });
    const flag = result.flags.find((f) => f.code === "CONTRAINDICATED_IN_PREGNANCY");
    expect(flag?.type).toBe("pregnancy_warning");
    expect(result.verdict).toBe("blocked");
  });

  it("flags a renal contraindication for an impaired patient", () => {
    const patient = makePatient({ renalStatus: "impaired" });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_spironolactone", doseMg: 25, frequencyPerDay: 1 }),
    });
    expect(result.flags.some((f) => f.code === "CONTRAINDICATED_RENAL" && f.type === "contraindication")).toBe(true);
  });

  it("flags geriatric caution for a benzodiazepine in an older adult", () => {
    const patient = makePatient({ dob: "1950-01-01" });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_diazepam", doseMg: 5, frequencyPerDay: 2 }),
    });
    expect(result.flags.some((f) => f.code === "GERIATRIC_CAUTION_CLASS" && f.type === "pediatric_geriatric_dosing")).toBe(true);
  });

  it("names the specific missing field on an incomplete prescription line", () => {
    const patient = makePatient();
    const result = screen({ patient, drugLine: makeLine({ strengthMg: 0 }) });
    const flag = result.flags.find((f) => f.code === "MISSING_STRENGTH");
    expect(flag?.type).toBe("missing_information");
    expect(result.verdict).not.toBe("safe");
  });

  it("flags an implausibly high dosing frequency as its own type", () => {
    const patient = makePatient();
    const result = screen({ patient, drugLine: makeLine({ doseMg: 500, frequencyPerDay: 8 }) });
    expect(result.flags.some((f) => f.code === "FREQUENCY_UNUSUALLY_HIGH" && f.type === "wrong_frequency")).toBe(true);
  });

  it("classifies an over-max daily dose as max_daily_dose", () => {
    const patient = makePatient();
    const result = screen({ patient, drugLine: makeLine({ doseMg: 1000, frequencyPerDay: 6 }) });
    const flag = result.flags.find((f) => f.code === "DOSE_ABOVE_MAX_PER_DAY");
    expect(flag?.type).toBe("max_daily_dose");
  });

  // --- Deeper clinical engine: cumulative dose, pregnancy category, renal/hepatic, pediatric data ---

  it("flags a cumulative daily dose exceeding max across two lines of the same drug", () => {
    // Two paracetamol lines, each 3000mg/day (individually under the 4000mg max),
    // together 6000mg/day — the single-line check passes but the cumulative one fires.
    const line1 = makeLine({ id: "line_1", doseMg: 1000, frequencyPerDay: 3 });
    const line2 = makeLine({ id: "line_2", doseMg: 1000, frequencyPerDay: 3 });
    const result = screen({ patient: makePatient(), drugLine: line2, otherLines: [line1, line2] });
    const flag = result.flags.find((f) => f.code === "CUMULATIVE_DOSE_ABOVE_MAX_PER_DAY");
    expect(flag?.type).toBe("max_daily_dose");
    expect(result.verdict).toBe("blocked");
  });

  it("does not raise a cumulative-dose flag when the drug appears on only one line", () => {
    const result = screen({
      patient: makePatient(),
      drugLine: makeLine({ doseMg: 500, frequencyPerDay: 3 }),
    });
    expect(result.flags.some((f) => f.code === "CUMULATIVE_DOSE_ABOVE_MAX_PER_DAY")).toBe(false);
  });

  it("blocks a pregnancy category X drug (warfarin) for a pregnant patient", () => {
    const patient = makePatient({ isPregnant: true });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_warfarin", doseMg: 5, frequencyPerDay: 1 }),
    });
    const flag = result.flags.find((f) => f.code === "PREGNANCY_CATEGORY_X");
    expect(flag?.type).toBe("pregnancy_warning");
    expect(flag?.severity).toBe("severe");
    expect(result.verdict).toBe("blocked");
  });

  it("blocks a pregnancy category D drug (losartan) for a pregnant patient", () => {
    const patient = makePatient({ isPregnant: true });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_losartan", doseMg: 50, frequencyPerDay: 1 }),
    });
    expect(result.flags.some((f) => f.code === "PREGNANCY_CATEGORY_D")).toBe(true);
    expect(result.verdict).toBe("blocked");
  });

  it("cautions on a pregnancy category C drug (ciprofloxacin) for a pregnant patient", () => {
    const patient = makePatient({ isPregnant: true });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_ciprofloxacin", doseMg: 500, frequencyPerDay: 2 }),
    });
    const flag = result.flags.find((f) => f.code === "PREGNANCY_CATEGORY_C");
    expect(flag?.type).toBe("pregnancy_warning");
    expect(flag?.severity).toBe("moderate");
  });

  it("does not raise a pregnancy flag for a category B drug in pregnancy (paracetamol)", () => {
    const patient = makePatient({ isPregnant: true });
    const result = screen({ patient, drugLine: makeLine({ drugId: "drug_paracetamol" }) });
    expect(result.flags.some((f) => f.type === "pregnancy_warning")).toBe(false);
  });

  it("blocks a renally-avoided drug (metformin) in renal impairment", () => {
    const patient = makePatient({ renalStatus: "impaired" });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_metformin", doseMg: 500, frequencyPerDay: 2 }),
    });
    const flag = result.flags.find((f) => f.code === "RENAL_AVOID");
    expect(flag?.type).toBe("contraindication");
    expect(result.verdict).toBe("blocked");
  });

  it("cautions with a dose-adjust flag for a renally-cleared drug (furosemide) in renal impairment", () => {
    const patient = makePatient({ renalStatus: "impaired" });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_furosemide", doseMg: 40, frequencyPerDay: 1 }),
    });
    const flag = result.flags.find((f) => f.code === "RENAL_DOSE_ADJUST");
    expect(flag?.severity).toBe("moderate");
    expect(result.verdict).not.toBe("safe");
  });

  it("cautions with a hepatic dose-adjust flag (metronidazole) in hepatic impairment", () => {
    const patient = makePatient({ hepaticStatus: "impaired" });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_metronidazole", doseMg: 400, frequencyPerDay: 3 }),
    });
    expect(result.flags.some((f) => f.code === "HEPATIC_DOSE_ADJUST")).toBe(true);
  });

  it("flags a missing pediatric dosing reference for a young child on an adult-only drug", () => {
    const patient = makePatient({
      dob: new Date(new Date().getFullYear() - 4, 0, 1).toISOString(),
      weightKg: 16,
    });
    // Metformin has no pediatric block in the formulary.
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_metformin", doseMg: 500, frequencyPerDay: 1 }),
    });
    const flag = result.flags.find((f) => f.code === "PEDIATRIC_DOSE_REFERENCE_MISSING");
    expect(flag?.type).toBe("pediatric_geriatric_dosing");
    expect(result.verdict).not.toBe("safe");
  });

  it("preserves the text-based pregnancy fallback for uncategorised drugs (doxycycline)", () => {
    const patient = makePatient({ isPregnant: true });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_doxycycline", doseMg: 100, frequencyPerDay: 1 }),
    });
    expect(result.flags.some((f) => f.code === "CONTRAINDICATED_IN_PREGNANCY")).toBe(true);
    expect(result.verdict).toBe("blocked");
  });

  // --- Allergy reaction text: names the actual reaction, not a generic placeholder ---

  it("states the concrete reaction for a direct allergy match instead of a generic placeholder", () => {
    const patient = makePatient({ allergies: [{ allergen: "Penicillin", severity: "severe" }] });
    const result = screen({ patient, drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500 }) });
    const flag = result.flags.find((f) => f.code === "ALLERGY_DIRECT_MATCH");
    expect(flag?.audience_variant.patient).toContain("anaphylaxis");
    expect(flag?.audience_variant.patient).not.toContain("it could cause a reaction");
  });

  it("states the concrete cross-reactive reaction (penicillin -> cephalosporin)", () => {
    const patient = makePatient({ allergies: [{ allergen: "Penicillin", severity: "moderate" }] });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_ceftriaxone", doseMg: 1000, frequencyPerDay: 1 }),
    });
    const flag = result.flags.find((f) => f.code === "ALLERGY_CROSS_REACTIVE");
    expect(flag?.audience_variant.patient).toContain("10% of patients");
    expect(flag?.audience_variant.patient).not.toContain("could still cause a reaction in some people");
  });

  // --- Indication check: patient-reported reason vs. drug's therapeutic class ---

  it("flags an indication mismatch when the drug's class doesn't match the reported condition", () => {
    const patient = makePatient({ reportedConditions: ["Diabetes"] });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500 }),
    });
    const flag = result.flags.find((f) => f.code === "INDICATION_MISMATCH");
    expect(flag?.type).toBe("indication_mismatch");
    expect(result.verdict).not.toBe("safe");
  });

  it("does not flag an indication mismatch when the drug's class matches the reported condition", () => {
    const patient = makePatient({ reportedConditions: ["Bacterial infection"] });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500 }),
    });
    expect(result.flags.some((f) => f.code === "INDICATION_MISMATCH")).toBe(false);
  });

  it("never raises an indication flag when no condition was reported", () => {
    const patient = makePatient({ reportedConditions: [] });
    const result = screen({ patient, drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500 }) });
    expect(result.flags.some((f) => f.type === "indication_mismatch")).toBe(false);
  });

  // ---------------------------------------------------------------------
  // "Unknown" must never resolve the same way as "confirmed normal/negative"
  // — this exact invariant was missing for renalStatus/hepaticStatus,
  // isPregnant, and age before this fix, which is how all three shipped
  // unnoticed. Each test below directly compares the confirmed-negative case
  // against the unknown case on the same drug, so a regression that makes
  // them collapse back to identical behaviour fails loudly.
  // ---------------------------------------------------------------------

  it("flags unknown renal status differently from confirmed-normal on a renally-avoided drug", () => {
    // Metformin is the only renally-avoided drug in the formulary, so it
    // can't be swapped for a drug without an unrelated flag — it also now
    // carries a real, sourced, unconditional alcohol-interaction flag
    // (severity "severe", per the FDA black-box warning) that permanently
    // floors its overall verdict at "blocked" regardless of renal status.
    // Asserting on the specific renal-related flag codes directly (rather
    // than the emergent verdict, which the alcohol flag now dominates) is
    // more precise anyway — it's what this test actually cares about.
    const line = makeLine({ drugId: "drug_metformin", doseMg: 500, frequencyPerDay: 2 });

    const normal = screen({ patient: makePatient({ renalStatus: "normal" }), drugLine: line });
    expect(normal.flags.some((f) => f.code === "RENAL_STATUS_UNKNOWN")).toBe(false);
    expect(normal.flags.some((f) => f.code === "RENAL_AVOID")).toBe(false);

    const unknown = screen({ patient: makePatient({ renalStatus: "unknown" }), drugLine: line });
    expect(unknown.flags.some((f) => f.code === "RENAL_STATUS_UNKNOWN")).toBe(true);
    // Distinct from the confirmed-impaired outcome too — "unknown" must not
    // be conflated with "confirmed impaired" (which raises RENAL_AVOID).
    expect(unknown.flags.some((f) => f.code === "RENAL_AVOID")).toBe(false);

    const impaired = screen({ patient: makePatient({ renalStatus: "impaired" }), drugLine: line });
    expect(impaired.flags.some((f) => f.code === "RENAL_AVOID")).toBe(true);
  });

  it("flags unknown hepatic status differently from confirmed-normal on a hepatically-adjusted drug", () => {
    const line = makeLine({ drugId: "drug_metronidazole", doseMg: 400, frequencyPerDay: 3 });

    const normal = screen({ patient: makePatient({ hepaticStatus: "normal" }), drugLine: line });
    expect(normal.flags.some((f) => f.code === "HEPATIC_STATUS_UNKNOWN")).toBe(false);

    const unknown = screen({ patient: makePatient({ hepaticStatus: "unknown" }), drugLine: line });
    expect(unknown.flags.some((f) => f.code === "HEPATIC_STATUS_UNKNOWN")).toBe(true);
    expect(unknown.verdict).not.toBe("safe");
  });

  it("flags unknown pregnancy status differently from confirmed-not-pregnant on a category X drug", () => {
    // Warfarin now also carries a real, sourced food-interaction flag
    // (vitamin K-rich foods, moderate severity — see foodInteractionRules.ts)
    // that's unconditional and unrelated to pregnancy status, so
    // confirmedNegative can no longer reach "safe" for a reason that has
    // nothing to do with what this test checks. Asserting on
    // PREGNANCY_STATUS_UNKNOWN specifically (rather than overall verdict)
    // isolates the actual thing under test.
    const line = makeLine({ drugId: "drug_warfarin", doseMg: 5, frequencyPerDay: 1 });

    const confirmedNegative = screen({ patient: makePatient({ isPregnant: false }), drugLine: line });
    expect(confirmedNegative.flags.some((f) => f.code === "PREGNANCY_STATUS_UNKNOWN")).toBe(false);
    expect(confirmedNegative.flags.some((f) => f.code === "PREGNANCY_CATEGORY_X")).toBe(false);

    const unknown = screen({ patient: makePatient({ isPregnant: null }), drugLine: line });
    expect(unknown.flags.some((f) => f.code === "PREGNANCY_STATUS_UNKNOWN")).toBe(true);
    expect(unknown.verdict).not.toBe("safe");
    // Distinct from the confirmed-pregnant outcome too (PREGNANCY_CATEGORY_X
    // blocks) — "unknown" floors at caution, it doesn't assume pregnant.
    expect(unknown.verdict).not.toBe("blocked");
  });

  it("does not flag pregnancy status unknown for a male patient", () => {
    const patient = makePatient({ isPregnant: null, sex: "male" });
    const result = screen({
      patient,
      drugLine: makeLine({ drugId: "drug_warfarin", doseMg: 5, frequencyPerDay: 1 }),
    });
    expect(result.flags.some((f) => f.code === "PREGNANCY_STATUS_UNKNOWN")).toBe(false);
  });

  it("flags unknown age differently from a confirmed adult on a geriatric-caution drug class", () => {
    const line = makeLine({ drugId: "drug_diazepam", doseMg: 5, frequencyPerDay: 2 });

    const knownAdult = screen({ patient: makePatient(), drugLine: line });
    expect(knownAdult.flags.some((f) => f.code === "AGE_DATA_UNKNOWN")).toBe(false);

    const ageUnknown = screen({ patient: makePatient({ ageYearsUnknown: true }), drugLine: line });
    expect(ageUnknown.flags.some((f) => f.code === "AGE_DATA_UNKNOWN")).toBe(true);
    expect(ageUnknown.verdict).not.toBe("safe");
  });

  it("flags unknown age differently from a confirmed adult when a drug has no pediatric dosing reference", () => {
    const line = makeLine({ drugId: "drug_metformin", doseMg: 500, frequencyPerDay: 1 });

    const knownAdult = screen({ patient: makePatient(), drugLine: line });
    expect(knownAdult.flags.some((f) => f.code === "AGE_DATA_UNKNOWN")).toBe(false);

    const ageUnknown = screen({ patient: makePatient({ ageYearsUnknown: true }), drugLine: line });
    expect(ageUnknown.flags.some((f) => f.code === "AGE_DATA_UNKNOWN")).toBe(true);
  });

  it("data completeness banner distinguishes renal/hepatic/pregnancy/age unknown from confirmed-normal patients", () => {
    const clean = screen({ patient: makePatient(), drugLine: makeLine() });
    expect(clean.flags.some((f) => f.severity === "unknown")).toBe(false);

    const allUnknown = screen({
      patient: makePatient({ renalStatus: "unknown", hepaticStatus: "unknown", isPregnant: null, ageYearsUnknown: true }),
      drugLine: makeLine(),
    });
    const unknownCodes = allUnknown.flags.filter((f) => f.severity === "unknown").map((f) => f.code);
    expect(unknownCodes).toEqual(
      expect.arrayContaining([
        "RENAL_STATUS_UNKNOWN",
        "HEPATIC_STATUS_UNKNOWN",
        "PREGNANCY_STATUS_UNKNOWN",
        "AGE_DATA_UNKNOWN",
      ])
    );
    expect(allUnknown.verdict).not.toBe("safe");
  });

  // ---------------------------------------------------------------------
  // Unrecognized drugId: 6+ of the 10 checks independently bail with []
  // when a drug isn't found, which stacked together meant an unrecognized
  // drug produced zero signal anywhere and resolved "safe" — the same
  // failure shape as the unknown-patient-attribute gaps above, just for
  // drug identity. Must fail loudly with one explicit flag instead.
  // ---------------------------------------------------------------------

  it("flags an unrecognized drugId instead of silently resolving safe", () => {
    const result = screen({
      patient: makePatient(),
      drugLine: makeLine({ drugId: "drug_totally_made_up_xyz" }),
    });
    expect(result.flags.some((f) => f.code === "UNRECOGNIZED_DRUG" && f.type === "unrecognized_drug")).toBe(
      true
    );
    expect(result.verdict).toBe("blocked");
  });

  it("a recognized drug never raises UNRECOGNIZED_DRUG", () => {
    const result = screen({ patient: makePatient(), drugLine: makeLine({ drugId: "drug_paracetamol" }) });
    expect(result.flags.some((f) => f.code === "UNRECOGNIZED_DRUG")).toBe(false);
  });

  it("still raises patient-level data-completeness flags for an unrecognized drug rather than suppressing them", () => {
    const result = screen({
      patient: makePatient({ allergies: null }),
      drugLine: makeLine({ drugId: "drug_totally_made_up_xyz" }),
    });
    expect(result.flags.some((f) => f.code === "UNRECOGNIZED_DRUG")).toBe(true);
    expect(result.flags.some((f) => f.code === "ALLERGY_DATA_UNKNOWN")).toBe(true);
  });

  it("does not run the other 9 checks for an unrecognized drug (no drug-specific flags beyond UNRECOGNIZED_DRUG)", () => {
    // A patient whose profile would trigger several other flags on a real
    // drug (missing weight, unknown renal status) should still only get the
    // one unrecognized-drug flag plus the patient-level banner — not a
    // confusing mix of "we don't know the drug" and "here's a dosing issue
    // for a drug we just said we don't recognize."
    const result = screen({
      patient: makePatient({ weightKg: null, renalStatus: "unknown" }),
      drugLine: makeLine({ drugId: "drug_totally_made_up_xyz", doseMg: 999999 }),
    });
    const nonBannerFlags = result.flags.filter((f) => f.type !== "data_incomplete");
    expect(nonBannerFlags).toHaveLength(1);
    expect(nonBannerFlags[0].code).toBe("UNRECOGNIZED_DRUG");
  });

  // ---------------------------------------------------------------------
  // Drug-food / drug-alcohol interactions: a different kind of check from
  // everything above. Every other "unknown" case in this file is about a
  // PATIENT attribute that could genuinely be missing (renal status,
  // pregnancy, age...) and must never silently resolve as if it were
  // confirmed-normal. These two checks have no patient-attribute input at
  // all — they're a pure drugId lookup against sourced reference data
  // (lib/formulary/ghana/{food,alcohol}InteractionRules.ts). A drug with no
  // matching rule genuinely has no known interaction of this type; that's
  // not missing data to flag as unknown, the same way emlCheck.ts doesn't
  // raise an unknown flag for a drug it simply has no EML data gap for.
  // ---------------------------------------------------------------------

  it("flags a sourced drug-food interaction with a real citation", () => {
    const result = screen({
      patient: makePatient(),
      drugLine: makeLine({ drugId: "drug_warfarin", doseMg: 5, frequencyPerDay: 1 }),
    });
    const flag = result.flags.find((f) => f.code === "DRUG_FOOD_INTERACTION");
    expect(flag?.type).toBe("drug_food_interaction");
    expect(flag?.referenceSource).toBeTruthy();
    expect(result.verdict).not.toBe("safe");
  });

  it("flags a sourced drug-alcohol interaction with a real citation", () => {
    const result = screen({
      patient: makePatient(),
      drugLine: makeLine({ drugId: "drug_metronidazole", doseMg: 400, frequencyPerDay: 3 }),
    });
    const flag = result.flags.find((f) => f.code === "DRUG_ALCOHOL_INTERACTION");
    expect(flag?.type).toBe("drug_alcohol_interaction");
    expect(flag?.referenceSource).toBeTruthy();
    expect(result.verdict).not.toBe("safe");
  });

  it("raises no food/alcohol flag — and no unknown-severity flag of any kind from these two checks — for a drug with no sourced rule", () => {
    // Amoxicillin has no entry in either reference file. Absence must
    // resolve as "no known interaction of this type," not "unknown, verify
    // manually" — the opposite of how a missing patient attribute behaves
    // elsewhere in this engine. A clean patient on a clean drug must still
    // reach "safe".
    const result = screen({
      patient: makePatient(),
      drugLine: makeLine({ drugId: "drug_amoxicillin", doseMg: 500, frequencyPerDay: 3 }),
    });
    expect(result.flags.some((f) => f.type === "drug_food_interaction")).toBe(false);
    expect(result.flags.some((f) => f.type === "drug_alcohol_interaction")).toBe(false);
    expect(result.verdict).toBe("safe");
  });

  it("every drug-food and drug-alcohol rule cites a real, non-empty reference source", () => {
    // A softer, dataset-wide version of the "don't fabricate" requirement:
    // every entry must carry a citation, not just the two spot-checked above.
    for (const rule of formulary.foodInteractionRules) {
      expect(rule.referenceSource.trim().length).toBeGreaterThan(0);
    }
    for (const rule of formulary.alcoholInteractionRules) {
      expect(rule.referenceSource.trim().length).toBeGreaterThan(0);
    }
  });
});
