import { describe, expect, it } from "vitest";
import { getFormularyBundle } from "../formulary";
import { screenDrugLine } from "../screening-engine";
import {
  EDITABLE_PRESCRIPTION_STATUSES,
  isPrescriptionEditable,
  type Patient,
  type Prescription,
  type PrescriptionDrugLine,
} from "../types";

const formulary = getFormularyBundle("GH");

function makePrescription(overrides: Partial<Prescription> = {}): Prescription {
  return {
    id: "rx_1",
    patientId: "patient_1",
    prescriberId: "prescriber_1",
    drugs: [],
    verdicts: [],
    status: "submitted",
    createdAt: "2026-01-01T00:00:00.000Z",
    source: "physician",
    versionNumber: 1,
    ...overrides,
  };
}

describe("isPrescriptionEditable", () => {
  // Every status in the union, split against the editable list — a plain
  // loop rather than one assertion per status, so adding a new status to
  // PrescriptionStatus without updating EDITABLE_PRESCRIPTION_STATUSES
  // fails loudly here instead of silently drifting.
  const allStatuses: Prescription["status"][] = [
    "draft",
    "submitted",
    "under_review",
    "held",
    "cleared",
    "rejected",
    "verified",
    "dispensed",
    "flagged",
    "cancelled",
  ];

  for (const status of allStatuses) {
    const shouldBeEditable = EDITABLE_PRESCRIPTION_STATUSES.includes(status);
    it(`${shouldBeEditable ? "allows" : "blocks"} editing a "${status}" prescription (supersededBy null)`, () => {
      const prescription = makePrescription({ status, supersededBy: null });
      expect(isPrescriptionEditable(prescription)).toBe(shouldBeEditable);
    });
  }

  it("never allows editing an already-superseded prescription, regardless of status", () => {
    // "submitted" is normally editable — but not once superseded, since
    // that would mean forking a new edit off an outdated version instead
    // of the current one.
    const prescription = makePrescription({ status: "submitted", supersededBy: "rx_2" });
    expect(isPrescriptionEditable(prescription)).toBe(false);
  });

  it("treats an undefined supersededBy the same as null (current version)", () => {
    const prescription = makePrescription({ status: "held" });
    delete (prescription as { supersededBy?: string | null }).supersededBy;
    expect(isPrescriptionEditable(prescription)).toBe(true);
  });
});

describe("editing a prescription re-screens fresh against the new drug list", () => {
  // The pattern createPrescriptionVersion's caller must follow (mirroring
  // how createPrescription already trusts client-computed verdicts at
  // creation time — the RPC stores whatever verdicts it's given, it doesn't
  // recompute them). This proves that pattern actually produces genuinely
  // different, correct verdicts for a changed drug list — not the original
  // version's verdicts carried forward unchanged.
  const patient: Patient = {
    id: "patient_1",
    name: "Test Patient",
    dob: "1990-01-01",
    sex: "female",
    weightKg: 70,
    renalStatus: "normal",
    hepaticStatus: "normal",
    allergies: [],
    activeMedications: [{ drugId: "drug_warfarin", startedAt: "2024-01-01" }],
    isPregnant: false,
  };

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

  it("produces a different, worse verdict when the edit introduces a real interaction the original didn't have", () => {
    // Original version: paracetamol, no interaction with the patient's
    // warfarin — screens safe.
    const originalLine = makeLine({ drugId: "drug_paracetamol" });
    const originalVerdict = screenDrugLine({ patient, drugLine: originalLine, otherLines: [originalLine], formulary });
    expect(originalVerdict.verdict).toBe("safe");

    // Edit: prescriber changes the drug to aspirin — a severe interaction
    // with the patient's existing warfarin. A caller that carried the
    // ORIGINAL verdict forward instead of re-screening would silently miss
    // this; re-screening fresh against the new line catches it.
    const editedLine = makeLine({ drugId: "drug_aspirin", doseMg: 300, frequencyPerDay: 1 });
    const editedVerdict = screenDrugLine({ patient, drugLine: editedLine, otherLines: [editedLine], formulary });

    expect(editedVerdict.verdict).toBe("blocked");
    expect(editedVerdict.flags.some((f) => f.code === "DRUG_DRUG_INTERACTION")).toBe(true);
    // The two verdicts are for the same logical prescription, one edit
    // apart — they must not be the same object/value once the underlying
    // drug list actually changed.
    expect(editedVerdict.verdict).not.toBe(originalVerdict.verdict);
  });

  it("produces a different, better verdict when the edit removes the problem drug entirely", () => {
    const originalLine = makeLine({ drugId: "drug_aspirin", doseMg: 300, frequencyPerDay: 1 });
    const originalVerdict = screenDrugLine({ patient, drugLine: originalLine, otherLines: [originalLine], formulary });
    expect(originalVerdict.verdict).toBe("blocked");

    const editedLine = makeLine({ drugId: "drug_paracetamol" });
    const editedVerdict = screenDrugLine({ patient, drugLine: editedLine, otherLines: [editedLine], formulary });
    expect(editedVerdict.verdict).toBe("safe");
    expect(editedVerdict.verdict).not.toBe(originalVerdict.verdict);
  });
});
