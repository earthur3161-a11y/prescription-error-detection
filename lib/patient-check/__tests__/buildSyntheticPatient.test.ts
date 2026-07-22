import { describe, expect, it } from "vitest";
import type { PatientCheckProfile } from "../../types";
import { buildSyntheticPatient } from "../buildSyntheticPatient";

function makeProfile(overrides: Partial<PatientCheckProfile> = {}): PatientCheckProfile {
  return {
    ageYears: null,
    weightKg: null,
    allergies: null,
    activeMedications: null,
    isPregnant: null,
    renalStatus: "unknown",
    hepaticStatus: "unknown",
    reportedConditions: [],
    complaintNote: null,
    ...overrides,
  };
}

describe("buildSyntheticPatient", () => {
  it("sets ageYearsUnknown when age is left blank, instead of fabricating a default age", () => {
    const patient = buildSyntheticPatient(makeProfile({ ageYears: null }));
    expect(patient.ageYearsUnknown).toBe(true);
  });

  it("does not set ageYearsUnknown when a real age is given", () => {
    const patient = buildSyntheticPatient(makeProfile({ ageYears: 8 }));
    expect(patient.ageYearsUnknown).toBeFalsy();
  });

  it("derives dob from the real age when age is given", () => {
    const currentYear = new Date().getFullYear();
    const patient = buildSyntheticPatient(makeProfile({ ageYears: 8 }));
    expect(patient.dob).toBe(`${currentYear - 8}-01-01`);
  });

  it("carries renal/hepatic/pregnancy unknown states through unchanged", () => {
    const patient = buildSyntheticPatient(
      makeProfile({ renalStatus: "unknown", hepaticStatus: "unknown", isPregnant: null })
    );
    expect(patient.renalStatus).toBe("unknown");
    expect(patient.hepaticStatus).toBe("unknown");
    expect(patient.isPregnant).toBeNull();
  });
});
