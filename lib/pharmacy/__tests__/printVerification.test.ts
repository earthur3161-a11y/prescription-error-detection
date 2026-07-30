import { describe, expect, it, vi } from "vitest";
import { printVerificationProof, type VerificationItem } from "../printVerification";
import type { Drug, DispenseRecord, Patient, PrescriptionDrugLine } from "../../types";
import type { Flag } from "../../screening-engine";

// This module embeds a ~5.5KB base64 font blob, making its first import
// meaningfully heavier than a typical pure-function test file — under full
// test-suite parallelism (13+ files competing for CPU), that first call can
// occasionally cross the default 5s timeout even though the logic itself is
// fast (confirmed: <20ms per call in isolation). Longer budget here, not a
// retry-the-flake workaround.
vi.setConfig({ testTimeout: 20000 });

function flag(overrides: Partial<Flag> = {}): Flag {
  return {
    type: "data_incomplete",
    code: "DEMO",
    severity: "minor",
    message: "demo",
    audience_variant: { clinical: "demo clinical text", patient: "demo patient text" },
    ...overrides,
  };
}

function drug(overrides: Partial<Drug> = {}): Drug {
  return {
    id: "drug_x",
    generic_name: "Demo Drug",
    brand_names: [],
    class: "Demo",
    standard_dose_range: { minMgPerDose: 1, maxMgPerDose: 2, maxMgPerDay: 4, frequency: "BID", weightBased: false },
    route: ["oral"],
    region_availability: ["GH"],
    onEssentialMedicinesList: true,
    ...overrides,
  };
}

function line(overrides: Partial<PrescriptionDrugLine> = {}): PrescriptionDrugLine {
  return {
    id: "l1",
    drugId: "drug_x",
    form: "tablet",
    strengthMg: 500,
    route: "oral",
    doseMg: 500,
    frequencyPerDay: 2,
    durationDays: 5,
    ...overrides,
  };
}

function record(overrides: Partial<DispenseRecord> = {}): DispenseRecord {
  return {
    id: "rec_1",
    prescriptionId: "rx_1",
    patientId: "patient_1",
    pharmacistId: "pharm_1",
    batchId: "batch_1",
    drugId: "drug_x",
    drugName: "Demo Drug",
    quantityDispensed: 10,
    dispensedAt: "2026-07-01T12:00:00.000Z",
    screeningVerdict: "safe",
    screeningFlags: [],
    screenedAt: "2026-07-01T11:59:00.000Z",
    ...overrides,
  };
}

const patient: Patient = {
  id: "patient_1",
  name: "ZZTEST_Print Patient",
  dob: "1990-01-01",
  sex: "female",
  weightKg: 60,
  renalStatus: "unknown",
  hepaticStatus: "normal",
  isPregnant: false,
  allergies: [],
  activeMedications: [],
};

/** Captures the HTML string printVerificationProof would have written to the popup window, without needing a real browser. Spies narrowly on window.open rather than replacing the whole jsdom window (spreading it is slow and fragile). */
function captureVerificationHtml(items: VerificationItem[]): string {
  let written = "";
  const fakeWindow = {
    document: {
      open: vi.fn(),
      write: (html: string) => {
        written = html;
      },
      close: vi.fn(),
    },
  };
  const openSpy = vi.spyOn(window, "open").mockReturnValue(fakeWindow as unknown as Window);
  printVerificationProof(patient, items, { name: "ZZTEST_Pharmacist", id: "pharm_1" });
  openSpy.mockRestore();
  return written;
}

describe("printVerificationProof — verdict-basis distinction on paper", () => {
  it("prints a confirmed caution as CAUTION — OVERRIDDEN, no 'unverified' qualifier", () => {
    const html = captureVerificationHtml([
      {
        drug: drug(),
        line: line(),
        record: record({ screeningVerdict: "caution", screeningFlags: [flag({ severity: "moderate" })], overrideNote: "Benefit clearly outweighs the modest interaction risk here." }),
      },
    ]);
    expect(html).toContain("CAUTION — OVERRIDDEN");
    expect(html).not.toContain("UNVERIFIED");
    expect(html).not.toContain("also unverified");
  });

  it("prints an unknown-only caution as UNVERIFIED, explicitly saying no confirmed finding exists", () => {
    const html = captureVerificationHtml([
      {
        drug: drug(),
        line: line(),
        record: record({
          screeningVerdict: "caution",
          screeningFlags: [flag({ severity: "unknown", message: "renal status not on file" })],
          overrideNote: "Proceeding — verified renal function verbally with patient at counter.",
        }),
      },
    ]);
    expect(html).toContain("UNVERIFIED — OVERRIDDEN");
    expect(html).toContain("no confirmed caution finding");
    expect(html).not.toContain(">CAUTION — OVERRIDDEN<");
  });

  it("prints a mixed caution (real finding + unknown data) with both facts, not just one", () => {
    const html = captureVerificationHtml([
      {
        drug: drug(),
        line: line(),
        record: record({
          screeningVerdict: "caution",
          screeningFlags: [flag({ severity: "moderate" }), flag({ severity: "unknown" })],
          overrideNote: "Confirmed with prescriber this is intentional despite missing renal data.",
        }),
      },
    ]);
    expect(html).toContain("CAUTION — OVERRIDDEN (some contributing data also unverified)");
  });

  it("prints a confirmed blocked as BLOCKED — OVERRIDDEN, unaffected by the basis logic", () => {
    const html = captureVerificationHtml([
      {
        drug: drug(),
        line: line(),
        record: record({
          screeningVerdict: "blocked",
          screeningFlags: [flag({ severity: "severe" })],
          overrideNote: "Prescriber consulted directly; proceeding per documented clinical judgment.",
        }),
      },
    ]);
    expect(html).toContain("BLOCKED — OVERRIDDEN");
    expect(html).not.toContain("UNVERIFIED");
  });

  it("still prints the unknownAware() 'NOT ON FILE — not screened' tag for the patient's own unknown renal status, unchanged from before restyling", () => {
    const html = captureVerificationHtml([{ drug: drug(), line: line(), record: record() }]);
    expect(html).toContain("NOT ON FILE — not screened");
    expect(html).toContain("Renal function");
  });

  it("forces background colors to survive printing across engines — all three declarations present as their own lines, not just as substrings of each other", () => {
    const html = captureVerificationHtml([{ drug: drug(), line: line(), record: record() }]);
    // Anchored on "start of a declaration" (newline + indentation immediately
    // followed by the exact property name) specifically so this can't pass
    // on a technicality — "print-color-adjust: exact" is itself a substring
    // of "-webkit-print-color-adjust: exact", and "color-adjust: exact" is a
    // substring of both, so a plain .toContain() here would pass even if
    // only the -webkit- line existed and the other two were deleted.
    expect(html).toMatch(/\n\s*-webkit-print-color-adjust:\s*exact;/); // older Safari/Chrome/Edge
    expect(html).toMatch(/\n\s*color-adjust:\s*exact;/); // Firefox's original (pre-rename) unprefixed name
    expect(html).toMatch(/\n\s*print-color-adjust:\s*exact;/); // current standard name
  });

  it("includes the IBM Plex Serif masthead font-face and the pharmacy letterhead", () => {
    const html = captureVerificationHtml([{ drug: drug(), line: line(), record: record() }]);
    expect(html).toContain("IBM Plex Serif Masthead");
    expect(html).toContain("MediGuard Community Pharmacy");
    expect(html).toContain("Dispense Verification Record");
  });

  it("lists all 12 check categories run by the orchestrator, including food/alcohol interaction — not a stale subset", () => {
    // Regression test: this line previously stopped at 10 categories and
    // never picked up food/alcohol interaction checks when those were added
    // to lib/screening-engine/orchestrator.ts — the flags themselves always
    // rendered correctly further down the page, only this summary undercounted.
    const html = captureVerificationHtml([{ drug: drug(), line: line(), record: record() }]);
    const match = html.match(/<b>Checks run:<\/b>\s*([^<]+)</);
    expect(match).not.toBeNull();
    const listed = (match![1] ?? "").split(",").map((s) => s.trim());
    expect(listed).toHaveLength(12);
    expect(listed).toEqual(
      expect.arrayContaining([
        "Patient data completeness",
        "Prescription completeness",
        "Allergy",
        "Drug interaction",
        "Duplicate therapy",
        "Dose range",
        "Cumulative dose",
        "Contraindication (renal / hepatic / pregnancy)",
        "Essential Medicines List status",
        "Indication match",
        "Food interaction",
        "Alcohol interaction",
      ])
    );
  });

  it("renders a distinct shape per verdict basis (seal for safe, ring for unknown-only) — not the same icon three times over", () => {
    const safeHtml = captureVerificationHtml([{ drug: drug(), line: line(), record: record({ screeningVerdict: "safe" }) }]);
    const unknownHtml = captureVerificationHtml([
      {
        drug: drug(),
        line: line(),
        record: record({
          screeningVerdict: "caution",
          screeningFlags: [flag({ severity: "unknown" })],
          overrideNote: "Verified verbally at counter with the patient present.",
        }),
      },
    ]);
    // ring draws a dashed circle + "?" text; seal draws a filled circle + checkmark path — no dasharray at all.
    expect(unknownHtml).toContain('stroke-dasharray="4.2 3.6"');
    expect(safeHtml).not.toContain("stroke-dasharray");
  });
});
