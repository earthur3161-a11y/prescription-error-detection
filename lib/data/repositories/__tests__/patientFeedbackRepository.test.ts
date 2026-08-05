import { describe, expect, it, vi } from "vitest";
import type { PatientFeedbackReportRow } from "../../../supabase/types";

const rpcMock = vi.fn();
const orderMock = vi.fn();
const selectMock = vi.fn(() => ({ order: orderMock }));
vi.mock("../../../supabase/client", () => ({
  supabase: { rpc: rpcMock, from: () => ({ select: selectMock }) },
}));

const { createPatientFeedbackReport, listPatientFeedbackReports } = await import("../patientFeedbackRepository");

function row(overrides: Partial<PatientFeedbackReportRow> = {}): PatientFeedbackReportRow {
  return {
    id: "fbk_1",
    patient_check_id: "check_1",
    message: "This result didn't match what my pharmacist told me.",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("patientFeedbackRepository.createPatientFeedbackReport", () => {
  it("calls the security-definer RPC (not a direct table insert) and maps the returned row", async () => {
    rpcMock.mockResolvedValueOnce({ data: row(), error: null });

    const report = await createPatientFeedbackReport({
      message: "This result didn't match what my pharmacist told me.",
      patientCheckId: "check_1",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_patient_feedback_report", {
      p_patient_check_id: "check_1",
      p_message: "This result didn't match what my pharmacist told me.",
    });
    expect(report).toEqual({
      id: "fbk_1",
      patientCheckId: "check_1",
      message: "This result didn't match what my pharmacist told me.",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("passes null (not undefined) for a report with no linked check", async () => {
    rpcMock.mockResolvedValueOnce({ data: row({ patient_check_id: null }), error: null });

    const report = await createPatientFeedbackReport({ message: "General feedback, no specific check." });

    expect(rpcMock).toHaveBeenCalledWith("create_patient_feedback_report", {
      p_patient_check_id: null,
      p_message: "General feedback, no specific check.",
    });
    expect(report.patientCheckId).toBeUndefined();
  });

  it("throws when the RPC returns an error, rather than silently swallowing it", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(createPatientFeedbackReport({ message: "x" })).rejects.toThrow("boom");
  });
});

describe("patientFeedbackRepository.listPatientFeedbackReports", () => {
  it("reads from the real shared table, newest first", async () => {
    orderMock.mockResolvedValueOnce({ data: [row(), row({ id: "fbk_2", patient_check_id: null })], error: null });

    const reports = await listPatientFeedbackReports();

    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(reports).toHaveLength(2);
    expect(reports[1].patientCheckId).toBeUndefined();
  });
});
