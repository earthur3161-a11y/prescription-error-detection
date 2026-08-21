import { afterEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
vi.mock("../../../supabase/client", () => ({
  supabase: { auth: { getSession: getSessionMock } },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { initiateSubscriptionPayment } = await import("../subscriptionRepository");

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("initiateSubscriptionPayment", () => {
  it("throws when there's no active session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    await expect(initiateSubscriptionPayment({ phone: "0244123456", provider: "mtn" })).rejects.toThrow(
      "You need to be signed in to subscribe."
    );
  });

  it("returns the initiate response verbatim on success", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { reference: "ref_new", awaitingOtp: true, displayMessage: "Enter the code sent to your phone." })
    );

    const result = await initiateSubscriptionPayment({ phone: "0244123456", provider: "mtn" });

    expect(result).toEqual({ reference: "ref_new", awaitingOtp: true, displayMessage: "Enter the code sent to your phone." });
  });

  // Regression coverage: a 409 payment_in_progress used to be thrown as a
  // plain Error with the reference embedded in the message text — the UI
  // could only show a confusing toast, with no way to resume the still-alive
  // charge (or its OTP step) that 409 is actually describing.
  it("resolves (doesn't throw) a 409 payment_in_progress into the same shape as a fresh initiate, so the caller can resume it", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: "payment_in_progress",
        message: "A payment is already in progress.",
        reference: "ref_old",
        awaitingOtp: true,
      })
    );

    const result = await initiateSubscriptionPayment({ phone: "0244123456", provider: "mtn" });

    expect(result).toEqual({
      reference: "ref_old",
      awaitingOtp: true,
      displayMessage: "A payment is already in progress.",
    });
  });

  it("still throws for a 409 with no reference (shouldn't happen, but no charge to resume)", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: "already_active", message: "Your subscription is already active." }));

    await expect(initiateSubscriptionPayment({ phone: "0244123456", provider: "mtn" })).rejects.toThrow(
      "Your subscription is already active."
    );
  });

  it("throws a plain error for a non-409 failure", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: "Couldn't start the payment." }));

    await expect(initiateSubscriptionPayment({ phone: "0244123456", provider: "mtn" })).rejects.toThrow(
      "Couldn't start the payment."
    );
  });
});
