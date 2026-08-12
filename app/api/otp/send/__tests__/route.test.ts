import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const rpcMock = vi.fn();
const maybeSingleMock = vi.fn();
const upsertMock = vi.fn();
const eqAfterSelectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqAfterSelectMock }));
const fromMock = vi.fn(() => ({ select: selectMock, upsert: upsertMock }));

vi.mock("@/lib/supabase/serviceClient", () => ({
  supabaseService: { rpc: rpcMock, from: fromMock },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { POST } = await import("../route");

function req(body: unknown) {
  return new Request("http://localhost/api/otp/send", { method: "POST", body: JSON.stringify(body) });
}

function jsonRes(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS;
  delete process.env.VERCEL_ENV;
  process.env.AFRICASTALKING_API_KEY = "test-key";
  process.env.AFRICASTALKING_USERNAME = "sandbox";
  rpcMock.mockResolvedValue({ data: [{ phone_verified: false }], error: null });
  maybeSingleMock.mockResolvedValue({ data: null, error: null });
  upsertMock.mockResolvedValue({ data: null, error: null });
  fetchMock.mockResolvedValue(
    jsonRes(200, { SMSMessageData: { Recipients: [{ status: "Success" }] } })
  );
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("POST /api/otp/send", () => {
  it("returns demoMode:true and never calls the SMS API when demo mode is allowed", async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS = "true";

    const res = await POST(req({ phone: "+233244123456" }));
    const body = await res.json();

    expect(body).toEqual({ sent: true, demoMode: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not_configured when Africa's Talking credentials are missing", async () => {
    delete process.env.AFRICASTALKING_API_KEY;

    const res = await POST(req({ phone: "+233244123456" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("not_configured");
  });

  it("short-circuits with alreadyVerified when the phone is already verified", async () => {
    rpcMock.mockResolvedValue({ data: [{ phone_verified: true }], error: null });

    const res = await POST(req({ phone: "+233244123456" }));
    expect(await res.json()).toEqual({ alreadyVerified: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rate-limits after 3 sends within the window", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { otp_send_count: 3, otp_last_sent_at: new Date().toISOString() },
      error: null,
    });

    const res = await POST(req({ phone: "+233244123456" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
  });

  it("sends via Africa's Talking and stores a hashed code with an expiry on success", async () => {
    const res = await POST(req({ phone: "+233244123456" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.sandbox.africastalking.com/version1/messaging",
      expect.objectContaining({ method: "POST" })
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "+233244123456",
        otp_verify_attempts: 0,
        otp_code_hash: expect.any(String),
        otp_expires_at: expect.any(String),
      }),
      { onConflict: "phone" }
    );
  });

  // Regression coverage: a real, previously-live bug — AFRICASTALKING_USERNAME
  // left as "sandbox" on the actual production deployment silently never
  // delivers real SMS (sandbox returns the same "Success" shape as live),
  // so every real patient got { sent: true } for a code that never arrived.
  it("refuses to fake-send when sandbox credentials are left on a real production deployment", async () => {
    process.env.VERCEL_ENV = "production";

    const res = await POST(req({ phone: "+233244123456" }));

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still sends normally in production once real (non-sandbox) credentials are configured", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.AFRICASTALKING_USERNAME = "mediguard-prod";

    const res = await POST(req({ phone: "+233244123456" }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.africastalking.com/version1/messaging",
      expect.anything()
    );
  });

  it("uses the live endpoint when username isn't literally 'sandbox'", async () => {
    process.env.AFRICASTALKING_USERNAME = "mediguard-prod";

    await POST(req({ phone: "+233244123456" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.africastalking.com/version1/messaging",
      expect.anything()
    );
  });

  it("returns 502 when the HTTP call itself fails", async () => {
    fetchMock.mockResolvedValue(jsonRes(500, { error: "boom" }));

    const res = await POST(req({ phone: "+233244123456" }));
    expect(res.status).toBe(502);
  });

  it("returns 502 when Africa's Talking responds 200 but the recipient status isn't Success", async () => {
    fetchMock.mockResolvedValue(
      jsonRes(200, { SMSMessageData: { Recipients: [{ status: "InvalidPhoneNumber" }] } })
    );

    const res = await POST(req({ phone: "+233244123456" }));
    expect(res.status).toBe(502);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
