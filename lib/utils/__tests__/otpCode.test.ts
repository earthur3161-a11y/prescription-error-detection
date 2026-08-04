import { describe, expect, it } from "vitest";
import { generateOtpCode, hashOtpCode, otpCodeMatches } from "../otpCode";

describe("generateOtpCode", () => {
  it("always returns a 6-digit numeric string, zero-padded", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("is not trivially predictable — 50 draws aren't all identical", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOtpCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("hashOtpCode", () => {
  it("is deterministic for the same phone+code", () => {
    expect(hashOtpCode("+233244123456", "123456")).toBe(hashOtpCode("+233244123456", "123456"));
  });

  it("differs for different codes on the same phone", () => {
    expect(hashOtpCode("+233244123456", "123456")).not.toBe(hashOtpCode("+233244123456", "654321"));
  });

  it("differs for the same code on different phones — never stores a bare code hash reusable across recipients", () => {
    expect(hashOtpCode("+233244123456", "123456")).not.toBe(hashOtpCode("+233200000000", "123456"));
  });

  it("never returns the plaintext code", () => {
    expect(hashOtpCode("+233244123456", "123456")).not.toContain("123456");
  });
});

describe("otpCodeMatches", () => {
  it("matches the correct code against its own hash", () => {
    const hash = hashOtpCode("+233244123456", "123456");
    expect(otpCodeMatches("+233244123456", "123456", hash)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const hash = hashOtpCode("+233244123456", "123456");
    expect(otpCodeMatches("+233244123456", "000000", hash)).toBe(false);
  });

  it("rejects the right code for the wrong phone — a hash is bound to its recipient", () => {
    const hash = hashOtpCode("+233244123456", "123456");
    expect(otpCodeMatches("+233200000000", "123456", hash)).toBe(false);
  });

  it("does not throw on a malformed/short stored hash (defends the timingSafeEqual length check)", () => {
    expect(() => otpCodeMatches("+233244123456", "123456", "not-a-real-hash")).not.toThrow();
    expect(otpCodeMatches("+233244123456", "123456", "not-a-real-hash")).toBe(false);
  });
});
