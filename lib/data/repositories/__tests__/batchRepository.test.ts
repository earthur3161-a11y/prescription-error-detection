import { describe, expect, it, vi } from "vitest";
import type { BatchRow } from "../../../supabase/types";

const orderMock = vi.fn();
const selectMock = vi.fn(() => ({ order: orderMock }));
vi.mock("../../../supabase/client", () => ({
  supabase: { from: () => ({ select: selectMock }) },
}));

const { listBatches } = await import("../batchRepository");

function row(overrides: Partial<BatchRow> = {}): BatchRow {
  return {
    id: "batch_1",
    drug_id: "drug_amoxicillin",
    batch_number: "ZZTEST-001",
    supplier: "ZZTEST Supplier",
    received_date: "2026-01-01",
    expiry_date: "2027-01-01",
    quantity_remaining: 100,
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    institution_id: "inst_korle_bu",
    owner_id: "pharmacist_1",
    ...overrides,
  };
}

describe("batchRepository.listBatches / mapRow", () => {
  it("surfaces institutionId and ownerId for an institutional batch", async () => {
    orderMock.mockResolvedValueOnce({ data: [row()], error: null });
    const [batch] = await listBatches();
    expect(batch.institutionId).toBe("inst_korle_bu");
    expect(batch.ownerId).toBe("pharmacist_1");
  });

  it("surfaces a null institutionId for an independent pharmacist's own stock", async () => {
    orderMock.mockResolvedValueOnce({ data: [row({ institution_id: null })], error: null });
    const [batch] = await listBatches();
    expect(batch.institutionId).toBeNull();
    expect(batch.ownerId).toBe("pharmacist_1");
  });
});
