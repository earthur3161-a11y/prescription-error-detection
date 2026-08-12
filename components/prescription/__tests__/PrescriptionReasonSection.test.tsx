import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Patient } from "@/lib/types";

const mutateMock = vi.fn();
const showToastMock = vi.fn();

vi.mock("@/lib/query/hooks/useUpdatePatient", () => ({
  useUpdatePatient: () => ({ mutate: mutateMock, isPending: false }),
}));

vi.mock("@/lib/store/toast-store", () => ({
  useToastStore: (selector: (s: { show: typeof showToastMock }) => unknown) => selector({ show: showToastMock }),
}));

const { PrescriptionReasonSection } = await import("../PrescriptionReasonSection");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const basePatient: Patient = {
  id: "pt1",
  name: "Test Patient",
  dob: "1990-01-01",
  sex: "female",
  weightKg: 60,
  renalStatus: "unknown",
  hepaticStatus: "unknown",
  allergies: null,
  activeMedications: null,
  isPregnant: null,
  ownerId: "doc1",
  reportedConditions: ["Diabetes"],
};

// Regression coverage: this is the data-capture gap that made
// lib/screening-engine/checks/indicationCheck.ts silently never fire for a
// physician's own patients — patient.reportedConditions was only ever
// populated by the separate Patient Self-Check flow. These lock in that
// toggling a condition here actually persists to the patient record the
// engine reads from.
describe("PrescriptionReasonSection", () => {
  it("shows the patient's currently reported conditions as pressed chips when editable", () => {
    render(<PrescriptionReasonSection patient={basePatient} editable />);
    expect(screen.getByRole("button", { name: "Diabetes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Malaria" })).toHaveAttribute("aria-pressed", "false");
  });

  it("persists the full updated condition list to the patient record on toggle, not just the new value", () => {
    render(<PrescriptionReasonSection patient={basePatient} editable />);
    fireEvent.click(screen.getByRole("button", { name: "Malaria" }));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pt1",
        patient: expect.objectContaining({ reportedConditions: ["Diabetes", "Malaria"] }),
      }),
      expect.anything()
    );
  });

  it("removing a condition sends the shorter list, not an empty one", () => {
    render(<PrescriptionReasonSection patient={basePatient} editable />);
    fireEvent.click(screen.getByRole("button", { name: "Diabetes" }));

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ patient: expect.objectContaining({ reportedConditions: [] }) }),
      expect.anything()
    );
  });

  it("shows a read-only summary instead of editable chips when not the owning prescriber", () => {
    render(<PrescriptionReasonSection patient={basePatient} editable={false} />);
    expect(screen.getByText("Diabetes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Malaria" })).not.toBeInTheDocument();
  });

  it("renders nothing read-only when there's no reason on file yet, rather than an empty box", () => {
    render(<PrescriptionReasonSection patient={{ ...basePatient, reportedConditions: [] }} editable={false} />);
    expect(screen.queryByText("Reason on file")).not.toBeInTheDocument();
  });
});
