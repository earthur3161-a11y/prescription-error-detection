import { describe, expect, it } from "vitest";
import { buildSuperadminActivity, type ActivitySources } from "../activity";
import type { SuperadminDispenseActivityRow } from "../../supabase/types";

function sources(overrides: Partial<ActivitySources> = {}): ActivitySources {
  return {
    accounts: [],
    prescriptions: [],
    overrides: [],
    dispenses: [],
    patientChecks: [],
    checkPayments: [],
    subscriptionPayments: [],
    accessRequests: [],
    institutions: [],
    apiKeys: [],
    ...overrides,
  };
}

function dispense(overrides: Partial<SuperadminDispenseActivityRow> = {}): SuperadminDispenseActivityRow {
  return {
    id: "disp_1",
    dispensed_at: "2026-07-01T00:00:00.000Z",
    prescription_id: "rx_1",
    patient_id: "patient_1",
    patient_name: "ZZTEST_Superadmin Patient",
    pharmacist_id: "pharmacist_1",
    pharmacist_name: "ZZTEST_Superadmin Pharmacist",
    quantity_dispensed: 20,
    ...overrides,
  };
}

describe("buildSuperadminActivity — dispense events", () => {
  it("builds a clinical_workflow event naming the pharmacist and patient, never the drug", () => {
    const [event] = buildSuperadminActivity(sources({ dispenses: [dispense()] }));
    expect(event.category).toBe("clinical_workflow");
    expect(event.actorRole).toBe("pharmacist");
    expect(event.actor).toBe("ZZTEST_Superadmin Pharmacist");
    expect(event.action).toContain("ZZTEST_Superadmin Patient");
    expect(event.tone).toBe("safe");
    // Defense in depth: the row itself carries no drug/verdict/flag/override
    // fields to leak, but assert the built event's own text never mentions
    // one either, in case a future field gets added to the row upstream.
    const serialized = JSON.stringify(event).toLowerCase();
    expect(serialized).not.toMatch(/drug|verdict|flag|override/);
  });

  it("sorts a dispense event into the combined reverse-chronological stream alongside other sources", () => {
    const events = buildSuperadminActivity(
      sources({
        dispenses: [dispense({ id: "disp_old", dispensed_at: "2026-01-01T00:00:00.000Z" })],
        prescriptions: [
          {
            id: "rx_new",
            created_at: "2026-06-01T00:00:00.000Z",
            status: "submitted",
            source: "physician",
            prescriber_id: "p1",
            prescriber_name: "Dr. ZZTEST",
            patient_id: "patient_2",
            patient_name: "ZZTEST_Other Patient",
          },
        ],
      })
    );
    expect(events.map((e) => e.id)).toEqual(["rx:rx_new", "disp:disp_old"]);
  });
});
