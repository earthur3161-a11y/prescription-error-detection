-- Institution API rate limiting for /api/v1/screen and
-- /cds-services/mediguard-screen — confirmed absent before this (no
-- middleware.ts, no per-key/per-route throttling anywhere in the codebase).
--
-- Approach (confirmed with the user): Supabase-backed, not Redis/Upstash.
-- This project runs on Vercel serverless functions, so an in-memory counter
-- would be worse than no rate limiting at all — it only ever sees requests
-- that happen to land on the same warm instance, giving a false sense of
-- protection while a real attacker (or just normal traffic spread across
-- instances) sails past it. Redis/Upstash is the textbook-correct answer
-- for serverless rate limiting, but would mean new infrastructure (a new
-- account, new env vars, a new dependency) this project doesn't have yet.
-- Supabase is already the project's one backing store, and already proves
-- this exact pattern works at this project's actual scale: see
-- self_check_accounts.otp_last_sent_at/otp_send_count in
-- 0001_phase1_auth.sql, the OTP send limiter this migration's design
-- directly mirrors.
--
-- Fixed-window counter, same algorithm as the OTP limiter: rate_window_start
-- marks when the current window began; rate_window_count counts requests in
-- it. A window that's expired resets rather than sliding. check_and_
-- increment_api_rate_limit() does the read-check-write atomically under a
-- row lock (`for update`), the same reason dispense_drug() (0010) and
-- create_prescription_version() (0016) don't do their own multi-step writes
-- as separate client calls — a plain read-then-write here would let two
-- concurrent requests both read the same count and both proceed, silently
-- admitting one request over the limit per race.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

alter table public.institution_api_keys add column if not exists rate_window_start timestamptz;
alter table public.institution_api_keys add column if not exists rate_window_count integer not null default 0;

create or replace function public.check_and_increment_api_rate_limit(
  p_key_id uuid,
  p_limit integer,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  window_reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.institution_api_keys%rowtype;
  v_now timestamptz := now();
  v_reset_at timestamptz;
begin
  select * into v_key from public.institution_api_keys where id = p_key_id for update;
  if not found then
    -- The caller (authorizeApiKey) already validated this key exists before
    -- ever reaching this RPC — not found here means something is
    -- inconsistent. Fail closed rather than silently allow.
    return query select false, p_window_seconds, v_now + make_interval(secs => p_window_seconds);
    return;
  end if;

  if v_key.rate_window_start is null or v_now - v_key.rate_window_start >= make_interval(secs => p_window_seconds) then
    -- No window yet, or the previous one has fully expired — start a fresh
    -- one with this request as the first in it.
    update public.institution_api_keys
      set rate_window_start = v_now, rate_window_count = 1
      where id = p_key_id;
    return query select true, 0, v_now + make_interval(secs => p_window_seconds);
    return;
  end if;

  v_reset_at := v_key.rate_window_start + make_interval(secs => p_window_seconds);

  if v_key.rate_window_count < p_limit then
    update public.institution_api_keys
      set rate_window_count = rate_window_count + 1
      where id = p_key_id;
    return query select true, 0, v_reset_at;
    return;
  end if;

  -- Over the limit — reject, and tell the caller exactly when the window
  -- resets so a real EHR integration can back off correctly instead of
  -- treating this as an unexplained failure.
  return query select false, greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer), v_reset_at;
end;
$$;

-- service_role only — same reasoning as dispense_drug() (0010): this is a
-- server-internal implementation detail of the auth chokepoint
-- (authorizeApiKey), never something a client should invoke directly, even
-- an authenticated one.
revoke all on function public.check_and_increment_api_rate_limit(uuid, integer, integer) from public;
revoke all on function public.check_and_increment_api_rate_limit(uuid, integer, integer) from authenticated;
grant execute on function public.check_and_increment_api_rate_limit(uuid, integer, integer) to service_role;
