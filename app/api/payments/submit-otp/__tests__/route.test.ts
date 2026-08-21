import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock }));

vi.mock("@/lib/supabase/serviceClient", () => ({
  supabaseService: { from: fromMock },
}));

const submitPaystackOtpMock = vi.fn();
vi.mock("@/lib/payments/paystackCharge", () => ({
  submitPaystackOtp: submitPaystackOtpMock,
}));

const resolveCheckPaymentMock = vi.fn();
vi.mock("@/lib/payments/resolveCheckPayment", () => ({
  resolveCheckPayment: resolveCheckPaymentMock,
}));

const { POST } = await import("../route");

function req(body: unknown) {
  return new Request("http://localhost/api/payments/submit-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, PAYSTACK_SECRET_KEY: "sk_test_x" };
  maybeSingleMock.mockResolvedValue({ data: { status: "pending", otp_submit_attempts: 0 }, error: null });
  submitPaystackOtpMock.mockResolvedValue({ ok: true, message: "Code accepted." });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("POST /api/payments/submit-otp", () => {
  it("returns not_configured when Paystack credentials are missing", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const res = await POST(req({ reference: "ref_1", otp: "123456" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("not_configured");
  });

  it("returns invalid_request when otp is missing", async () => {
    const res = await POST(req({ reference: "ref_1" }));
    expect(res.status).toBe(422);
    expect(submitPaystackOtpMock).not.toHaveBeenCalled();
  });

  it("returns not_found for an unknown reference", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    const res = await POST(req({ reference: "ref_missing", otp: "123456" }));
    expect(res.status).toBe(404);
    expect(submitPaystackOtpMock).not.toHaveBeenCalled();
  });

  it("skips Paystack and reports ok: false when the payment is no longer pending", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { status: "success", otp_submit_attempts: 0 }, error: null });
    const res = await POST(req({ reference: "ref_1", otp: "123456" }));
    expect(await res.json()).toEqual({ ok: false, message: "This payment is no longer waiting for a code." });
    expect(submitPaystackOtpMock).not.toHaveBeenCalled();
  });

  it("relays the OTP to Paystack and returns its result for a pending payment", async () => {
    const res = await POST(req({ reference: "ref_1", otp: "123456" }));
    expect(submitPaystackOtpMock).toHaveBeenCalledWith("sk_test_x", "ref_1", "123456");
    expect(await res.json()).toEqual({ ok: true, message: "Code accepted." });
  });

  it("clears awaiting_otp once Paystack accepts the code", async () => {
    await POST(req({ reference: "ref_1", otp: "123456" }));
    expect(updateMock).toHaveBeenCalledWith({ awaiting_otp: false });
    expect(updateEqMock).toHaveBeenCalledWith("provider_reference", "ref_1");
  });

  // Regression coverage: this anonymous, unauthenticated relay had no
  // attempt limit at all before — an adversarial review found it could be
  // hammered indefinitely by anyone holding the reference, unlike the
  // sibling SMS-OTP route (OTP_MAX_VERIFY_ATTEMPTS).
  it("counts a genuine wrong-code rejection against the attempt cap", async () => {
    submitPaystackOtpMock.mockResolvedValueOnce({ ok: false, message: "Invalid code" });
    await POST(req({ reference: "ref_1", otp: "000000" }));
    expect(updateMock).toHaveBeenCalledWith({ otp_submit_attempts: 1 });
  });

  it("does NOT count a transient failure (network/Paystack outage) against the attempt cap", async () => {
    submitPaystackOtpMock.mockResolvedValueOnce({ ok: false, message: "Couldn't reach Paystack.", transient: true });
    await POST(req({ reference: "ref_1", otp: "123456" }));
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("locks out and fails the payment once the attempt cap is reached, without calling Paystack again", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { status: "pending", otp_submit_attempts: 5 }, error: null });
    const res = await POST(req({ reference: "ref_1", otp: "123456" }));
    expect(submitPaystackOtpMock).not.toHaveBeenCalled();
    expect(resolveCheckPaymentMock).toHaveBeenCalledWith("ref_1", false);
    expect(await res.json()).toEqual({ ok: false, message: "Too many incorrect attempts. Please start a new payment." });
  });
});
