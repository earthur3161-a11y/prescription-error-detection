-- Phase 3 Supabase migration: monetize the Patient Self-Check flow. 3 free
-- lifetime checks per (OTP-verified) phone number, then a Paystack Mobile
-- Money payment is required before a screening verdict is ever shown. The
-- actual enforcement lives entirely in create_patient_check_with_quota below
-- — patient_checks loses its anon insert policy so there is no path to a
-- check that doesn't go through phone verification and the quota/payment
-- check first. Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- normalize_gh_phone: single source of truth for phone comparison/storage,
-- so "0244123456" / "+233244123456" / "233244123456" resolve to the same
-- self_check_accounts row. Mirrors normalize_access_request_email's
-- defense-in-depth reasoning (0001_phase1_auth.sql) — used both inline by
-- the RPCs below (for lookups) and as a before-insert/update trigger on
-- every table that stores a phone, as a belt-and-braces safety net against
-- a future caller that forgets to normalize.
-- ---------------------------------------------------------------------------

create or replace function public.normalize_gh_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') ~ '^0\d{9}$'
      then '+233' || substring(regexp_replace(p_phone, '\D', '', 'g') from 2)
    when regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') ~ '^233\d{9}$'
      then '+' || regexp_replace(p_phone, '\D', '', 'g')
    else regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
  end;
$$;

create or replace function public.normalize_gh_phone_trigger()
returns trigger
language plpgsql
as $$
begin
  new.phone := public.normalize_gh_phone(new.phone);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- self_check_accounts: one row per (normalized) phone number — the durable
-- identity record for this flow. Tracks OTP-verification state, lightweight
-- send-rate-limit bookkeeping, and lifetime free-check usage. No anon
-- policies at all — even more locked down than patient_checks, since there
-- is no legitimate reason for a client to touch this table directly. Every
-- write happens either inside a SECURITY DEFINER function (bypasses RLS
-- internally, same reasoning as get_patient_check_by_id) or via the
-- service-role client from a route handler (the OTP-verify route, which is
-- the only writer of phone_verified).
-- ---------------------------------------------------------------------------

create table if not exists public.self_check_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  phone text not null unique,
  phone_verified boolean not null default false,
  otp_send_count int not null default 0,
  otp_last_sent_at timestamptz,
  free_checks_used int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.self_check_accounts enable row level security;

drop trigger if exists self_check_accounts_normalize_phone on public.self_check_accounts;
create trigger self_check_accounts_normalize_phone
  before insert or update on public.self_check_accounts
  for each row execute function public.normalize_gh_phone_trigger();

-- Staff-only visibility (support/compliance) — matches every other table's
-- authenticated-read philosophy. No anon select/insert/update at all.
drop policy if exists "self_check_accounts_select_authenticated" on public.self_check_accounts;
create policy "self_check_accounts_select_authenticated"
  on public.self_check_accounts for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- check_payments: one row per Paystack Mobile Money charge attempt. Same
-- full RLS lockdown — written only via the service-role client
-- (payments/initiate inserts, payments/paystack-webhook updates).
-- ---------------------------------------------------------------------------

create table if not exists public.check_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  phone text not null,
  amount_pesewas int not null,
  provider text not null default 'paystack',
  provider_reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  consumed boolean not null default false,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists check_payments_phone_idx on public.check_payments (phone);

alter table public.check_payments enable row level security;

drop trigger if exists check_payments_normalize_phone on public.check_payments;
create trigger check_payments_normalize_phone
  before insert or update on public.check_payments
  for each row execute function public.normalize_gh_phone_trigger();

drop policy if exists "check_payments_select_authenticated" on public.check_payments;
create policy "check_payments_select_authenticated"
  on public.check_payments for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- patient_checks: add phone (support/compliance traceability only — NOT the
-- enforcement mechanism) and client_request_id (idempotency key, so a lost
-- response + client retry can't consume a second credit for one attempt).
-- Drop the anon insert policy: the ONLY way an anon caller can create a row
-- here now is create_patient_check_with_quota below, which enforces phone
-- verification and the 3-free/then-pay gate atomically with the insert
-- itself. Confirmed via grep: the only other writer, scripts/seed-supabase.ts,
-- uses the service-role client and is unaffected by this policy change.
-- ---------------------------------------------------------------------------

alter table public.patient_checks add column if not exists phone text;
alter table public.patient_checks add column if not exists client_request_id uuid;

create unique index if not exists patient_checks_client_request_id_idx
  on public.patient_checks (client_request_id) where client_request_id is not null;

drop trigger if exists patient_checks_normalize_phone on public.patient_checks;
create trigger patient_checks_normalize_phone
  before insert or update on public.patient_checks
  for each row execute function public.normalize_gh_phone_trigger();

drop policy if exists "patient_checks_insert_any" on public.patient_checks;
-- Deliberately no replacement anon insert policy.

-- ---------------------------------------------------------------------------
-- get_check_quota: read-only, safe to call speculatively while the patient
-- is still typing their phone number. Reports free credits remaining, any
-- already-paid-but-unconsumed credit (so a payment that succeeded in a
-- prior, abandoned session doesn't force a second charge), and whether the
-- phone has already completed OTP verification (so a returning verified
-- patient can skip that step).
-- ---------------------------------------------------------------------------

create or replace function public.get_check_quota(p_phone text)
returns table (free_remaining int, paid_available int, phone_verified boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    greatest(0, 3 - coalesce(
      (select sca.free_checks_used from public.self_check_accounts sca
        where sca.phone = public.normalize_gh_phone(p_phone)), 0)) as free_remaining,
    coalesce((select count(*)::int from public.check_payments cp
      where cp.phone = public.normalize_gh_phone(p_phone)
        and cp.status = 'success' and cp.consumed = false), 0) as paid_available,
    coalesce((select sca.phone_verified from public.self_check_accounts sca
      where sca.phone = public.normalize_gh_phone(p_phone)), false) as phone_verified;
$$;

revoke all on function public.get_check_quota(text) from public;
grant execute on function public.get_check_quota(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_patient_check_with_quota: the ONLY way an anon caller creates a
-- patient_checks row. Atomic — phone-verification check, quota consumption,
-- and the insert all happen in one transaction, so a failure anywhere rolls
-- back the whole thing and no credit/payment is ever "spent" without a
-- check to show for it. p_client_request_id makes retries of the SAME
-- attempt idempotent (lost response + client retry replays the existing
-- check instead of consuming a second credit).
-- ---------------------------------------------------------------------------

create or replace function public.create_patient_check_with_quota(
  p_phone text,
  p_drugs jsonb,
  p_profile jsonb,
  p_verdicts jsonb,
  p_client_request_id uuid default null
)
returns table (
  allowed boolean,
  reason text,
  check_id uuid,
  created_at timestamptz,
  share_token text,
  free_remaining int,
  paid_available int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_gh_phone(p_phone);
  v_verified boolean;
  v_free_used int;
  v_payment_id uuid;
  v_check_id uuid;
  v_created_at timestamptz;
  v_share_token text;
  v_existing record;
begin
  if p_client_request_id is not null then
    select pc.id, pc.created_at, pc.share_token into v_existing
    from public.patient_checks pc where pc.client_request_id = p_client_request_id;
    if found then
      return query
        select true, null::text, v_existing.id, v_existing.created_at, v_existing.share_token,
          q.free_remaining, q.paid_available
        from public.get_check_quota(v_phone) q;
      return;
    end if;
  end if;

  insert into public.self_check_accounts (phone) values (v_phone)
    on conflict (phone) do nothing;

  -- Row lock serializes concurrent calls for the SAME phone (two tabs, a
  -- retried request) so they can't both read free_checks_used = 2 and both
  -- proceed as if they were the 3rd free check.
  select sca.phone_verified, sca.free_checks_used into v_verified, v_free_used
  from public.self_check_accounts sca where sca.phone = v_phone for update;

  if v_verified is not true then
    return query select false, 'not_verified'::text, null::uuid, null::timestamptz, null::text, 0, 0;
    return;
  end if;

  if v_free_used < 3 then
    update public.self_check_accounts set free_checks_used = free_checks_used + 1
      where phone = v_phone;
  else
    select cp.id into v_payment_id from public.check_payments cp
      where cp.phone = v_phone and cp.status = 'success' and cp.consumed = false
      order by cp.created_at asc limit 1 for update;

    if v_payment_id is null then
      return query select false, 'no_credit'::text, null::uuid, null::timestamptz, null::text, 0, 0;
      return;
    end if;

    update public.check_payments set consumed = true where id = v_payment_id;
  end if;

  v_check_id := extensions.gen_random_uuid();
  v_created_at := now();
  v_share_token := extensions.gen_random_uuid()::text;

  insert into public.patient_checks (id, created_at, drugs, profile, verdicts, share_token, phone, client_request_id)
  values (v_check_id, v_created_at, p_drugs, p_profile, p_verdicts, v_share_token, v_phone, p_client_request_id);

  return query
    select true, null::text, v_check_id, v_created_at, v_share_token, q.free_remaining, q.paid_available
    from public.get_check_quota(v_phone) q;
end;
$$;

revoke all on function public.create_patient_check_with_quota(text, jsonb, jsonb, jsonb, uuid) from public;
grant execute on function public.create_patient_check_with_quota(text, jsonb, jsonb, jsonb, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_payment_status: for the client's polling loop after initiating a
-- Mobile Money charge.
-- ---------------------------------------------------------------------------

create or replace function public.get_payment_status(p_reference text)
returns table (status text)
language sql
security definer
set search_path = public
stable
as $$
  select cp.status from public.check_payments cp where cp.provider_reference = p_reference;
$$;

revoke all on function public.get_payment_status(text) from public;
grant execute on function public.get_payment_status(text) to anon, authenticated;
