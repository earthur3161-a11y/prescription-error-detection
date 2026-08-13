import { afterEach, describe, expect, it, vi } from "vitest";

// Real chain: .update({...}).eq("provider_reference", ref).eq("status", "pending").select(...)
const selectAfterUpdateMock = vi.fn();
const updateEqStatusMock = vi.fn(() => ({ select: selectAfterUpdateMock }));
const updateEqRefMock = vi.fn(() => ({ eq: updateEqStatusMock }));
const updateMock = vi.fn(() => ({ eq: updateEqRefMock }));

const maybeSingleMock = vi.fn();
const selectEqProductMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectEqOwnerMock = vi.fn(() => ({ eq: selectEqProductMock }));
const selectMock = vi.fn(() => ({ eq: selectEqOwnerMock }));

const upsertMock = vi.fn((..._args: unknown[]) => Promise.resolve({ error: null }));

const fromMock = vi.fn((table: string) => {
  if (table === "subscription_payments") return { update: updateMock };
  return { select: selectMock, upsert: upsertMock };
});

vi.mock("../../supabase/serviceClient", () => ({
  supabaseService: { from: fromMock },
}));

const { resolveSubscriptionPayment } = await import("../resolveSubscriptionPayment");

function paymentRow(overrides: Partial<{ id: string; owner_id: string; product: string; period_days: number }> = {}) {
  return { id: "sp_1", owner_id: "user_1", product: "physician_portal", period_days: 30, ...overrides };
}

afterEach(() => vi.clearAllMocks());

describe("resolveSubscriptionPayment", () => {
  it("activates a new subscription (no prior row) on success", async () => {
    selectAfterUpdateMock.mockResolvedValueOnce({ data: [paymentRow()], error: null });
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await resolveSubscriptionPayment("ref_1", true);

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "success" }));
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: "user_1", product: "physician_portal", status: "active" }),
      { onConflict: "owner_id,product" }
    );
    expect(result).toEqual({ resolved: true });
  });

  it("extends from the current expiry, not from now, when it's still in the future", async () => {
    selectAfterUpdateMock.mockResolvedValueOnce({ data: [paymentRow()], error: null });
    const futureEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    maybeSingleMock.mockResolvedValueOnce({ data: { period_end: futureEnd }, error: null });

    await resolveSubscriptionPayment("ref_1", true);

    const upsertArg = upsertMock.mock.calls[0][0] as { period_end: string };
    // 30 days on top of the existing future end, not 30 days from today.
    const expected = new Date(new Date(futureEnd).getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(new Date(upsertArg.period_end).getTime()).toBe(expected.getTime());
  });

  it("marks the payment failed and never touches subscriptions when succeeded=false", async () => {
    selectAfterUpdateMock.mockResolvedValueOnce({ data: [paymentRow()], error: null });

    const result = await resolveSubscriptionPayment("ref_1", false);

    expect(updateMock).toHaveBeenCalledWith({ status: "failed" });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ resolved: true });
  });

  it("is a safe no-op when the row is already resolved (not pending anymore)", async () => {
    // .eq("status", "pending") means an already-resolved row matches
    // nothing — the update returns an empty array, not an error.
    selectAfterUpdateMock.mockResolvedValueOnce({ data: [], error: null });

    const result = await resolveSubscriptionPayment("ref_1", true);

    expect(upsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ resolved: false });
  });

  it("throws when the update itself errors, rather than silently swallowing it", async () => {
    selectAfterUpdateMock.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(resolveSubscriptionPayment("ref_1", true)).rejects.toThrow("boom");
  });
});
