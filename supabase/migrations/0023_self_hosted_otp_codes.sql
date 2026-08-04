-- Adds the columns needed for app/api/otp/send and app/api/otp/verify to own
-- OTP code generation, expiry, and attempt-limiting themselves.
--
-- Twilio Verify (the previous SMS provider) managed all of this internally --
-- code generation, expiry, and brute-force attempt-limiting on the verify
-- step -- this app just called Send/VerificationCheck and trusted the
-- result. Switching to Africa's Talking (chosen for direct MTN/Vodafone/
-- AirtelTigo Ghana routing and Mobile-Money-fundable billing, unlike
-- Twilio's card-only requirement) means this app takes over that
-- responsibility, since Africa's Talking is a raw SMS-send API with no
-- built-in OTP/Verify equivalent.
--
-- otp_code_hash: sha256(phone + ":" + code), never the plaintext code --
-- same principle as never storing a password in plaintext, even though the
-- code is short-lived and single-use. otp_expires_at: rejects a stale code
-- outright, independent of attempt count. otp_verify_attempts: the actual
-- brute-force defense for a 6-digit (1-in-a-million) code space -- reset to
-- 0 on every new send, checked (not just incremented) on every verify
-- attempt so a locked-out phone can't keep guessing against the same code.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

alter table public.self_check_accounts
  add column if not exists otp_code_hash text,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists otp_verify_attempts int not null default 0;
