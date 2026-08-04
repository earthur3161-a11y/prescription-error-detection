import "server-only";
import { randomInt, createHash, timingSafeEqual } from "node:crypto";

/** A random 6-digit numeric code, using a CSPRNG (not Math.random()) — this is a security credential, not a UI id. */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * Never store the plaintext code — same principle as never storing a
 * password in plaintext, even though this one is short-lived and single-use.
 * Bound to the phone number so the same 6-digit code hashes differently per
 * recipient (cheap to add, no real downside).
 */
export function hashOtpCode(phone: string, code: string): string {
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

/**
 * Constant-time comparison against the stored hash — the actual brute-force
 * defense for a 6-digit (1-in-a-million) space is the caller's attempt
 * limit, not this, but there's no reason to leak timing information either.
 */
export function otpCodeMatches(phone: string, code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtpCode(phone, code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}
