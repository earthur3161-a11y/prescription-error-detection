import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

// Regression coverage for a real, live production gap: NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS
// was left set to "true" in Vercel's production environment, making OTP
// verification accept any code for any phone number — no real SMS involved.
// This is the one place that decision is made; every other guarantee in this
// fix depends on this function actually refusing demo mode on production.
describe("isOtpDemoModeAllowed", () => {
  it("is false when the dev-accounts flag is unset, regardless of environment", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS;
    delete process.env.VERCEL_ENV;
    const { isOtpDemoModeAllowed } = await import("../otpDemoMode");
    expect(isOtpDemoModeAllowed()).toBe(false);
  });

  it("is true locally (no VERCEL_ENV) when the flag is explicitly on", async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS = "true";
    delete process.env.VERCEL_ENV;
    const { isOtpDemoModeAllowed } = await import("../otpDemoMode");
    expect(isOtpDemoModeAllowed()).toBe(true);
  });

  it("is true on a Vercel preview deployment when the flag is on", async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS = "true";
    process.env.VERCEL_ENV = "preview";
    const { isOtpDemoModeAllowed } = await import("../otpDemoMode");
    expect(isOtpDemoModeAllowed()).toBe(true);
  });

  it("is FALSE on a real Vercel production deployment even when the flag is left on — the exact live gap this fix closes", async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS = "true";
    process.env.VERCEL_ENV = "production";
    const { isOtpDemoModeAllowed } = await import("../otpDemoMode");
    expect(isOtpDemoModeAllowed()).toBe(false);
  });
});
