import "server-only";

/**
 * Whether OTP send/verify are allowed to run in simulated (no real SMS,
 * accept-any-code) mode. Deliberately narrower than DEV_ACCOUNTS_ENABLED
 * (lib/data/seed/accounts.ts): that flag is meant to let a live, public-looking
 * Vercel deployment still seed demo professional logins for prospects to try —
 * a low-stakes convenience. This one gates real-world phone-identity proof for
 * real patients redeeming real free checks, so it must never be overridable by
 * the same flag on an actual production deployment, no matter what someone
 * leaves set in Vercel's dashboard. VERCEL_ENV is set by Vercel itself and
 * can't be fat-fingered the way a custom env var can — checking it here means
 * this bypass is structurally impossible on a real production deploy, not
 * just supposed to be off by convention.
 */
export function isOtpDemoModeAllowed(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS === "true" && process.env.VERCEL_ENV !== "production";
}
