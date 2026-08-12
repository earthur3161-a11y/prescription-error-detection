import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashOtpCode } from "@/lib/utils/otpCode";

const ORIGINAL_ENV = { ...process.env };

const maybeSingleMock = vi.fn();
const eqAfterSelectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqAfterSelectMock }));
const updateEqMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const upsertMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock, upsert: upsertMock }));

vi.mock("@/lib/supabase/serviceClient", () => ({
  supabaseService: { from: fromMock },
}));

const { POST } = await import("../route");

const PHONE = "+233244123456";

function req(body: unknown) {
  return new Request("http://localhost/api/otp/verify", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("POST /api/otp/verify — demo mode", () => {
  it("accepts any well-formed code and marks the phone verified", async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS = "true";

    const res = await POST(req({ phone: PHONE, code: "000000" }));
    expect(await res.json()).toEqual({ verified: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ phone: PHONE, phone_verified: true }),
      { onConflict: "phone" }
    );
  });
});

describe("POST /api/otp/verify — self-hosted code checking", () => {
  // Regression coverage: send() and verify() must normalize identically, or
  // a code hashed/stored under "+233244123456" (what send() writes) could
  // never be found again if verify() looked it up under "0244123456" (what
  // a client might resubmit) instead.
  it("normalizes a locally-formatted phone the same way send() does, so the lookup still finds the account", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        otp_code_hash: hashOtpCode(PHONE, "123456"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        otp_verify_attempts: 0,
      },
      error: null,
    });

    const res = await POST(req({ phone: "0244123456", code: "123456" }));

    expect(await res.json()).toEqual({ verified: true });
    expect(eqAfterSelectMock).toHaveBeenCalledWith("phone", PHONE);
  });


  it("returns verified:false when no code was ever sent to this phone", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const res = await POST(req({ phone: PHONE, code: "123456" }));
    expect(await res.json()).toEqual({ verified: false });
  });

  it("locks out after OTP_MAX_VERIFY_ATTEMPTS with a distinct, actionable error", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        otp_code_hash: hashOtpCode(PHONE, "123456"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        otp_verify_attempts: 5,
      },
      error: null,
    });

    const res = await POST(req({ phone: PHONE, code: "999999" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("too_many_attempts");
  });

  it("rejects an expired code with a distinct, actionable error — even if the code is correct", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        otp_code_hash: hashOtpCode(PHONE, "123456"),
        otp_expires_at: new Date(Date.now() - 1000).toISOString(),
        otp_verify_attempts: 0,
      },
      error: null,
    });

    const res = await POST(req({ phone: PHONE, code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("code_expired");
  });

  it("increments the attempt counter on a wrong code, without verifying", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        otp_code_hash: hashOtpCode(PHONE, "123456"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        otp_verify_attempts: 2,
      },
      error: null,
    });

    const res = await POST(req({ phone: PHONE, code: "000000" }));

    expect(await res.json()).toEqual({ verified: false });
    expect(updateMock).toHaveBeenCalledWith({ otp_verify_attempts: 3 });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("verifies on a correct, unexpired code and clears the consumed code (single-use)", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        otp_code_hash: hashOtpCode(PHONE, "123456"),
        otp_expires_at: new Date(Date.now() + 60_000).toISOString(),
        otp_verify_attempts: 1,
      },
      error: null,
    });

    const res = await POST(req({ phone: PHONE, code: "123456" }));

    expect(await res.json()).toEqual({ verified: true });
    expect(upsertMock).toHaveBeenCalledWith(
      {
        phone: PHONE,
        phone_verified: true,
        otp_code_hash: null,
        otp_expires_at: null,
        otp_verify_attempts: 0,
      },
      { onConflict: "phone" }
    );
    expect(updateMock).not.toHaveBeenCalled();
  });
});
