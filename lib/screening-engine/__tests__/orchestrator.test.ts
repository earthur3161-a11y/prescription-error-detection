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
    const result = screen({ patient: makePatient(), drugLine: makeLine() });
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
    const result = screen({ patient, drugLine: makeLine() });
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
});
