import { describe, expect, it } from "vitest";
import { buildAuditEvents, type AuditLookups, type AuditSources } from "../auditEvents";
import type { PatientCheck } from "../../types";

function sources(overrides: Partial<AuditSources> = {}): AuditSources {
  return { prescriptions: [], patientChecks: [], overrideLogs: [], pharmacistActions: [], ...overrides };
}

const lookups: AuditLookups = { patients: [], drugs: [], users: [] };

function check(overrides: Partial<PatientCheck> = {}): PatientCheck {
  return {
    id: "check_1",
    createdAt: "2026-07-01T00:00:00.000Z",
    drugs: [],
    profile: {} as PatientCheck["profile"],
    verdicts: [{ drugId: "drug_amoxicillin", lineId: "l1", verdict: "safe", flags: [], screenedAt: "2026-07-01T00:00:00.000Z" }],
    shareToken: "tok_1",
    ...overrides,
  };
}

describe("buildAuditEvents — patient self-check institution exclusion", () => {
  it("excludes a self-check never pulled into a prescription (no institution to attribute it to)", () => {
    const events = buildAuditEvents(sources({ patientChecks: [check({ pulledIntoPrescriptionId: undefined })] }), lookups);
    expect(events.some((e) => e.id === "check:check_1")).toBe(false);
  });

  it("includes a self-check once it's been pulled into a real prescription", () => {
    const events = buildAuditEvents(
      sources({ patientChecks: [check({ pulledIntoPrescriptionId: "rx_1" })] }),
      lookups
    );
    const event = events.find((e) => e.id === "check:check_1");
    expect(event).toBeDefined();
    expect(event?.prescriptionId).toBe("rx_1");
    expect(event?.detail).toBe("Later pulled into a pharmacy prescription.");
  });

  it("does not let an excluded self-check crowd out an unrelated prescription event", () => {
    const events = buildAuditEvents(
      sources({
        patientChecks: [check({ id: "check_unpulled", pulledIntoPrescriptionId: undefined })],
        prescriptions: [
          {
            id: "rx_2",
            patientId: "patient_1",
            prescriberId: "prescriber_1",
            drugs: [],
            verdicts: [],
            status: "submitted",
            createdAt: "2026-07-01T00:00:00.000Z",
            source: "physician",
            institutionId: "inst_1",
            versionNumber: 1,
          },
        ],
      }),
      lookups
    );
    expect(events.some((e) => e.id === "check:check_unpulled")).toBe(false);
    expect(events.some((e) => e.id === "check:rx_2")).toBe(true);
  });
});
