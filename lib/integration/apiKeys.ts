import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { ApiKeyMode } from "../supabase/types";

const KEY_PREFIX_LENGTH = 14;

export interface GeneratedApiKey {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
}

/**
 * Real, cryptographically-random API key generation — replaces the old
 * client-side generateId()-based keys (Math.random() + Date.now(), never
 * actually checked against anything server-side). The raw key is returned
 * exactly once, at mint time; only its sha256 hash is ever persisted.
 * Deterministic hashing (not bcrypt) is correct here: API keys carry enough
 * entropy on their own, and every screening call needs an O(1) exact-match
 * lookup, not a slow verify-many.
 */
export function generateApiKey(mode: ApiKeyMode): GeneratedApiKey {
  const rawKey = `mg_${mode}_${randomBytes(24).toString("base64url")}`;
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH),
    keyHash: hashApiKey(rawKey),
  };
}

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}
