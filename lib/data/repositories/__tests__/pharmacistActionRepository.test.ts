import { describe, expect, it, vi } from "vitest";
import type { PharmacistActionRow } from "../../../supabase/types";

// Regression coverage: pharmacist_actions used to live entirely in per-browser
// Dexie/IndexedDB (db.pharmacistActions) — a request_clarification action
// never reached the prescriber it was for, since nothing outside that one
// browser could ever read it. These tests lock in the real Supabase-backed
// behavior, mirroring overrideLogRepository.ts's own direct insert/select
// pattern (not the SECURITY DEFINER RPC pattern patient_checks/feedback use —
// pharmacist_actions writers are always authenticated pharmacists/prescribers,
// not anonymous patients, so RLS on the table itself is the right boundary).

const singleMock = vi.fn();
const selectAfterInsertMock = vi.fn(() => ({ single: singleMock }));
const insertMock = vi.fn(() => ({ select: selectAfterInsertMock }));

const orderMock = vi.fn();
const eqMock = vi.fn(() => ({ order: orderMock }));
const selectMock = vi.fn(() => ({ eq: eqMock, order: orderMock }));

const fromMock = vi.fn(() => ({ insert: insertMock, select: selectMock }));

vi.mock("../../../supabase/client", () => ({
  supabase: { from: fromMock },
}));

const { appendPharmacistAction, listActionsByPrescription, listAllPharmacistActions } = await import(
  "../pharmacistActionRepository"
);

function row(overrides: Partial<PharmacistActionRow> = {}): PharmacistActionRow {
  return {
    id: "pact_1",
    prescription_id: "rx_1",
    pharmacist_id: "user_1",
    action: "approve",
    actor_role: "pharmacist",
    reason: null,
    clarification_drug_id: null,
    intervention_outcome: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("pharmacistActionRepository.appendPharmacistAction", () => {
  it("inserts into the real shared table and maps the returned row", async () => {
    singleMock.mockResolvedValueOnce({ data: row({ action: "hold", reason: "Awaiting stock" }), error: null });

    const action = await appendPharmacistAction({
      prescriptionId: "rx_1",
      pharmacistId: "user_1",
      action: "hold",
      actorRole: "pharmacist",
      reason: "Awaiting stock",
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prescription_id: "rx_1",
        pharmacist_id: "user_1",
        action: "hold",
        actor_role: "pharmacist",
        reason: "Awaiting stock",
      })
    );
    expect(action).toMatchObject({ prescriptionId: "rx_1", action: "hold", reason: "Awaiting stock" });
  });

  it("allows a prescriber_response action — the new capability that closes the clarification loop", async () => {
    singleMock.mockResolvedValueOnce({
      data: row({ action: "prescriber_response", pharmacist_id: "prescriber_1", actor_role: "prescriber", reason: "Confirmed 500mg" }),
      error: null,
    });

    const action = await appendPharmacistAction({
      prescriptionId: "rx_1",
      pharmacistId: "prescriber_1",
      action: "prescriber_response",
      actorRole: "prescriber",
      reason: "Confirmed 500mg",
    });

    expect(action.action).toBe("prescriber_response");
    expect(action.pharmacistId).toBe("prescriber_1");
  });

  // Regression coverage: an independent physician self-approving their own
  // prescription must be tagged actor_role: "prescriber" — never conflated
  // with a genuine pharmacist's independent review in the audit trail. See
  // 0033_independent_physician_self_service.sql.
  it("tags an independent physician's own self-approval with actorRole: prescriber, not pharmacist", async () => {
    singleMock.mockResolvedValueOnce({
      data: row({ pharmacist_id: "physician_1", actor_role: "prescriber" }),
      error: null,
    });

    const action = await appendPharmacistAction({
      prescriptionId: "rx_1",
      pharmacistId: "physician_1",
      action: "approve",
      actorRole: "prescriber",
    });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ actor_role: "prescriber" }));
    expect(action.actorRole).toBe("prescriber");
  });

  it("throws when the insert is rejected (e.g. by RLS), rather than silently swallowing it", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error("new row violates row-level security policy") });
    await expect(
      appendPharmacistAction({ prescriptionId: "rx_1", pharmacistId: "user_1", action: "approve", actorRole: "pharmacist" })
    ).rejects.toThrow("row-level security");
  });

  it("maps optional fields to undefined, not null, on the returned domain object", async () => {
    singleMock.mockResolvedValueOnce({ data: row(), error: null });
    const action = await appendPharmacistAction({
      prescriptionId: "rx_1",
      pharmacistId: "user_1",
      action: "approve",
      actorRole: "pharmacist",
    });
    expect(action.reason).toBeUndefined();
    expect(action.clarificationDrugId).toBeUndefined();
    expect(action.interventionOutcome).toBeUndefined();
  });
});

describe("pharmacistActionRepository.listActionsByPrescription", () => {
  it("filters by prescription and orders oldest first (a chronological thread)", async () => {
    orderMock.mockResolvedValueOnce({ data: [row(), row({ id: "pact_2", action: "dispense" })], error: null });

    const actions = await listActionsByPrescription("rx_1");

    expect(eqMock).toHaveBeenCalledWith("prescription_id", "rx_1");
    expect(orderMock).toHaveBeenCalledWith("timestamp", { ascending: true });
    expect(actions).toHaveLength(2);
  });
});

describe("pharmacistActionRepository.listAllPharmacistActions", () => {
  it("reads from the real shared table, newest first", async () => {
    orderMock.mockResolvedValueOnce({ data: [row()], error: null });
    const actions = await listAllPharmacistActions();
    expect(orderMock).toHaveBeenCalledWith("timestamp", { ascending: false });
    expect(actions).toHaveLength(1);
  });
});
