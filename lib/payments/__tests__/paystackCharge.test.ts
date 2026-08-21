import { afterEach, describe, expect, it, vi } from "vitest";
import { initiatePaystackMobileMoneyCharge, submitPaystackOtp } from "../paystackCharge";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function chargeResponse(status: string, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      status: true,
      message: "Charge attempted",
      data: { reference: "ref_1", status, display_text: "display text", ...extra },
    }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

// Regression coverage: this is the actual bug — the charge response's
// data.status was never read at all, so a Mobile Money charge that Paystack
// put into "send_otp" (waiting on a code relay via /charge/submit_otp) was
// reported identically to "pay_offline" (a real prompt needing no further
// action), leaving the OTP relay step nobody ever built with no way to run.
describe("initiatePaystackMobileMoneyCharge", () => {
  it("reports awaitingOtp: true and Paystack's own display_text when status is send_otp", async () => {
    fetchMock.mockResolvedValueOnce(chargeResponse("send_otp"));

    const result = await initiatePaystackMobileMoneyCharge("sk_test_x", "a@b.com", 1000, "0244123456", "mtn", "[test]");

    expect(result).toEqual({
      reference: "ref_1",
      authorizationUrl: "",
      awaitingOtp: true,
      displayMessage: "display text",
    });
  });

  it("reports awaitingOtp: false for pay_offline — a real prompt was already sent, no relay needed", async () => {
    fetchMock.mockResolvedValueOnce(chargeResponse("pay_offline"));

    const result = await initiatePaystackMobileMoneyCharge("sk_test_x", "a@b.com", 1000, "0244123456", "mtn", "[test]");

    expect(result).toEqual({
      reference: "ref_1",
      authorizationUrl: "",
      awaitingOtp: false,
      displayMessage: "display text",
    });
  });

  it("reports success immediately when Paystack's charge status is already success", async () => {
    fetchMock.mockResolvedValueOnce(chargeResponse("success"));

    const result = await initiatePaystackMobileMoneyCharge("sk_test_x", "a@b.com", 1000, "0244123456", "mtn", "[test]");

    expect(result).toEqual({
      reference: "ref_1",
      authorizationUrl: "",
      awaitingOtp: false,
      displayMessage: "Payment successful.",
    });
  });

  // Regression coverage: a synchronously-declined charge (still HTTP ok,
  // chargeBody.status: true, with a reference) used to fall into the
  // "pay_offline" catch-all, reporting a definitively-failed charge as
  // "approve the payment on your phone" until the separate /verify poll
  // eventually caught up.
  it("returns null for a synchronously-declined charge (data.status: failed) instead of treating it like pay_offline", async () => {
    fetchMock.mockResolvedValueOnce(chargeResponse("failed"));

    const result = await initiatePaystackMobileMoneyCharge("sk_test_x", "a@b.com", 1000, "0244123456", "mtn", "[test]");

    expect(result).toBeNull();
    // No fallback to /transaction/initialize either — this is a definitive
    // answer from Paystack, not a call that failed outright.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to transaction/initialize when the charge call fails outright", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ status: false, message: "no channel" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: true,
          message: "ok",
          data: { reference: "ref_2", authorization_url: "https://checkout.paystack.com/xyz", access_code: "ac" },
        }),
      });

    const result = await initiatePaystackMobileMoneyCharge("sk_test_x", "a@b.com", 1000, "0244123456", "mtn", "[test]");

    expect(result).toEqual({
      reference: "ref_2",
      authorizationUrl: "https://checkout.paystack.com/xyz",
      awaitingOtp: false,
      displayMessage: "Opening payment page...",
    });
  });
});

describe("submitPaystackOtp", () => {
  it("posts the otp and reference to Paystack's submit_otp endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: true, message: "Charge complete", data: { status: "success" } }),
    });

    const result = await submitPaystackOtp("sk_test_x", "ref_1", "123456");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.paystack.co/charge/submit_otp",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ otp: "123456", reference: "ref_1" }),
      })
    );
    expect(result).toEqual({ ok: true, message: "Charge complete" });
  });

  it("reports ok: false with Paystack's message when the code is rejected", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: true, message: "Invalid code", data: { status: "failed" } }),
    });

    const result = await submitPaystackOtp("sk_test_x", "ref_1", "000000");

    expect(result).toEqual({ ok: false, message: "Invalid code" });
  });

  it("reports ok: false and transient: true on network failure instead of throwing", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const result = await submitPaystackOtp("sk_test_x", "ref_1", "123456");

    expect(result).toEqual({ ok: false, message: "Couldn't reach Paystack. Please try again.", transient: true });
  });

  it("reports ok: false and transient: true on an HTTP-level failure — not a wrong-code rejection", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ status: false, message: "rate limited" }) });

    const result = await submitPaystackOtp("sk_test_x", "ref_1", "123456");

    expect(result).toEqual({ ok: false, message: "rate limited", transient: true });
  });

  // Regression coverage: submit_otp reporting "send_otp" again (e.g. the
  // first code expired) used to be treated as ok:true "Code accepted",
  // which both call sites use to drop the OTP input — stranding the user
  // with no way to submit the new code Paystack is now actually waiting on.
  it("reports ok: false (not accepted) when Paystack asks for another code", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: true, message: "Enter the new code sent to your phone", data: { status: "send_otp" } }),
    });

    const result = await submitPaystackOtp("sk_test_x", "ref_1", "123456");

    expect(result).toEqual({ ok: false, message: "Enter the new code sent to your phone" });
  });

  // Regression coverage: `??` only falls back on null/undefined, not on an
  // empty-but-present string — a real Paystack message of "" would have
  // silently produced no visible error at all.
  it("falls back to a default message when Paystack returns an empty (but present) message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: true, message: "", data: { status: "failed" } }),
    });

    const result = await submitPaystackOtp("sk_test_x", "ref_1", "000000");

    expect(result.message).toBe("That code wasn't accepted. Please try again.");
  });
});
