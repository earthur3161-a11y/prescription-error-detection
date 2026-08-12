import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { isOtpDemoModeAllowed } from "@/lib/utils/otpDemoMode";
import { otpCodeMatches } from "@/lib/utils/otpCode";
import { toE164Gh } from "@/lib/utils/phone";

const bodySchema = z.object({ phone: z.string().min(6), code: z.string().min(3).max(10) });

const OTP_MAX_VERIFY_ATTEMPTS = 5;

async function markPhoneVerified(phone: string) {
  // Clears the consumed code (single-use — prevents replaying the same code
  // after it's already succeeded once) and resets the attempt counter, in
  // addition to setting phone_verified.
  return supabaseService.from("self_check_accounts").upsert(
    { phone, phone_verified: true, otp_code_hash: null, otp_expires_at: null, otp_verify_attempts: 0 },
    { onConflict: "phone" }
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "A phone number and code are required." }, { status: 422 });
  }
  // Normalized the same way app/api/otp/send/route.ts does — must produce
  // the identical string for the self_check_accounts lookup below to ever
  // find the row send() wrote.
  const phone = toE164Gh(parsed.data.phone);
  const { code } = parsed.data;

  // Same simulated-verification convention already used by the seeded demo
  // logins' MFA step — any code that passes the schema above is accepted.
  // Hardened beyond the flag alone: see lib/utils/otpDemoMode.ts for why
  // this can never activate on an actual Vercel production deployment.
  if (isOtpDemoModeAllowed()) {
    const { error } = await markPhoneVerified(phone);
    if (error) {
      console.error("[otp/verify] (demo mode) Failed to mark phone verified:", error);
      return Response.json({ error: "internal_error", message: "Verification succeeded but couldn't be saved." }, { status: 500 });
    }
    return Response.json({ verified: true });
  }

  // Africa's Talking has no built-in OTP/Verify equivalent (unlike the
  // previous provider), so expiry and brute-force attempt-limiting on a
  // 6-digit (1-in-a-million) code space are this app's own responsibility —
  // see 0023_self_hosted_otp_codes.sql and app/api/otp/send.
  const { data: account, error: lookupError } = await supabaseService
    .from("self_check_accounts")
    .select("otp_code_hash, otp_expires_at, otp_verify_attempts")
    .eq("phone", phone)
    .maybeSingle();

  if (lookupError) {
    console.error("[otp/verify] Lookup failed:", lookupError);
    return Response.json({ error: "internal_error", message: "Couldn't check verification status." }, { status: 500 });
  }

  // No code was ever sent to this phone (or it was already consumed by a
  // prior successful verify) — nothing to check against.
  if (!account?.otp_code_hash || !account.otp_expires_at) {
    return Response.json({ verified: false });
  }

  if (account.otp_verify_attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    return Response.json(
      { error: "too_many_attempts", message: "Too many incorrect attempts. Request a new code." },
      { status: 429 }
    );
  }

  if (new Date(account.otp_expires_at).getTime() < Date.now()) {
    return Response.json(
      { error: "code_expired", message: "This code has expired. Request a new one." },
      { status: 400 }
    );
  }

  if (!otpCodeMatches(phone, code, account.otp_code_hash)) {
    await supabaseService
      .from("self_check_accounts")
      .update({ otp_verify_attempts: account.otp_verify_attempts + 1 })
      .eq("phone", phone);
    return Response.json({ verified: false });
  }

  // The only writer of phone_verified outside demo mode: a client can never
  // set this itself, only a matching hash (i.e. the SMS the patient actually
  // received) gets here.
  const { error } = await markPhoneVerified(phone);

  if (error) {
    console.error("[otp/verify] Failed to mark phone verified:", error);
    return Response.json({ error: "internal_error", message: "Verification succeeded but couldn't be saved." }, { status: 500 });
  }

  return Response.json({ verified: true });
}
