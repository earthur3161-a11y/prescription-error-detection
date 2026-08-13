import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const getUserMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@/lib/supabase/serviceClient", () => ({
  supabaseService: { auth: { getUser: getUserMock }, from: fromMock },
}));

const resolveSubscriptionPaymentMock = vi.fn();
vi.mock("@/lib/payments/resolveSubscriptionPayment", () => ({
  resolveSubscriptionPayment: resolveSubscriptionPaymentMock,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { POST } = await import("../route");

function req(body: unknown, bearer = "valid-token") {
  return new Request("http://localhost/api/subscriptions/verify", {
    method: "POST",
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    body: JSON.stringify(body),
  });
}

function paystackVerifyResponse(status: string) {
  return { ok: true, json: async () => ({ data: { status } }) };
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, PAYSTACK_SECRET_KEY: "sk_test_x" };
  getUserMock.mockResolvedValue({ data: { user: { id: "user_1" } }, error: null });
  maybeSingleMock.mockResolvedValue({ data: { owner_id: "user_1", status: "pending" }, error: null });
  fetchMock.mockResolvedValue(paystackVerifyResponse("success"));
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("POST /api/subscriptions/verify", () => {
  it("returns not_configured when Paystack credentials are missing", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const res = await POST(req({ reference: "ref_1" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("not_configured");
  });

  it("returns unauthorized without a bearer token", async () => {
    const res = await POST(req({ reference: "ref_1" }, ""));
    expect(res.status).toBe(401);
  });

  it("returns not_found rather than resolving a reference belonging to a different owner", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { owner_id: "someone_else", status: "pending" }, error: null });
    const res = await POST(req({ reference: "ref_1" }));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveSubscriptionPaymentMock).not.toHaveBeenCalled();
  });

  it("returns the stored status without calling Paystack when already resolved", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { owner_id: "user_1", status: "success" }, error: null });
    const res = await POST(req({ reference: "ref_1" }));
    expect(await res.json()).toEqual({ status: "success" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Regression coverage: this is the actual bug — every subscription_payments
  // row in production was stuck "pending" including a confirmed real charge,
  // because nothing ever independently re-checked with Paystack. This locks
  // in that a still-pending row now gets a real answer from Paystack itself.
  it("asks Paystack directly and activates the subscription when it reports success", async () => {
    const res = await POST(req({ reference: "ref_1" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/verify/ref_1",
      expect.objectContaining({ headers: { Authorization: "Bearer sk_test_x" } })
    );
    expect(resolveSubscriptionPaymentMock).toHaveBeenCalledWith("ref_1", true);
    expect(await res.json()).toEqual({ status: "success" });
  });

  it("marks the payment failed when Paystack reports a failed/abandoned/reversed charge", async () => {
    fetchMock.mockResolvedValueOnce(paystackVerifyResponse("abandoned"));
    const res = await POST(req({ reference: "ref_1" }));
    expect(resolveSubscriptionPaymentMock).toHaveBeenCalledWith("ref_1", false);
    expect(await res.json()).toEqual({ status: "failed" });
  });

  it("reports pending, not an error, when Paystack itself still shows the charge pending", async () => {
    fetchMock.mockResolvedValueOnce(paystackVerifyResponse("pending"));
    const res = await POST(req({ reference: "ref_1" }));
    expect(resolveSubscriptionPaymentMock).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ status: "pending" });
  });

  it("URL-encodes the reference so it can't break the request path", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { owner_id: "user_1", status: "pending" }, error: null });
    await POST(req({ reference: "ref/with slash" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.paystack.co/transaction/verify/ref%2Fwith%20slash",
      expect.anything()
    );
  });
});
