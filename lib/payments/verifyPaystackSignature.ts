import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Paystack signs webhooks with a raw HMAC-SHA512 hex digest of the request
// body against an x-paystack-signature header — a different scheme from the
// Standard Webhooks spec used by send-email-hook (HMAC-SHA256, base64
// secret, webhook-id/timestamp/signature headers), so that package doesn't
// apply here. Must be called with the raw request body text, not a
// parsed/re-serialized object — the digest is over the exact bytes Paystack
// sent.
export function verifyPaystackSignature(rawBody: string, signatureHeader: string, secretKey: string): boolean {
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
