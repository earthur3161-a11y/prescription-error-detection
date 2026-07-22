-- Phase E: Super Admin system-wide oversight — account visibility across all
-- 4 account types (Physician, Pharmacy, Facility Admin, Patient self-check)
-- plus a unified, deliberately non-clinical activity feed.
--
-- Scope, deliberately: READ-ONLY. No insert/update/delete policy is added
-- anywhere in this migration, and no existing policy is dropped or narrowed
-- — every grant here is a new, additive, permissive SELECT policy scoped to
-- `(auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'`, OR'd alongside
-- whatever owner-scoped policy already exists on that table (Postgres RLS
-- policies are OR'd together, same mechanism profiles already uses). No
-- existing role's boundary changes: a prescriber/pharmacist/admin session
-- never matches `role = 'superadmin'`, so none of these new policies ever
-- apply to them.
--
-- Clinical tables (patients, prescriptions, override_logs, patient_checks)
-- are NOT given a superadmin RLS policy at all — a broad `using (true)` OR
-- clause would let a superadmin session pull drugs/verdicts/allergies via a
-- direct PostgREST call regardless of what the dashboard UI selects. Instead
-- this migration adds narrow SECURITY DEFINER RPCs that hard-code the
-- column list to non-clinical fields only, with the superadmin check INSIDE
-- the function body (a SECURITY DEFINER function bypasses RLS internally, so
-- the role gate has to live in the function itself, not rely on RLS) — same
-- shape as check_access_request_status / get_patient_check_by_id already in
-- this codebase. Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- institutions / subscriptions / subscription_payments: no clinical content
-- in any of these (billing + institution metadata only), so a plain additive
-- RLS policy is enough — no RPC indirection needed.
-- ---------------------------------------------------------------------------

drop policy if exists "institutions_select_superadmin" on public.institutions;
create policy "institutions_select_superadmin"
  on public.institutions for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

drop policy if exists "subscriptions_select_superadmin" on public.subscriptions;
create policy "subscriptions_select_superadmin"
  on public.subscriptions for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

drop policy if exists "subscription_payments_select_superadmin" on public.subscription_payments;
create policy "subscription_payments_select_superadmin"
  on public.subscription_payments for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

-- ---------------------------------------------------------------------------
-- institution_api_keys: the base table carries key_hash and has zero client
-- policies (deny-all) by design — mirrors institution_api_keys_public
-- (0007_institutions_api.sql) exactly, but scoped to superadmin instead of
-- "my own institution", and never selects key_hash.
-- ---------------------------------------------------------------------------

create or replace view public.institution_api_keys_superadmin as
  select id, institution_id, mode, key_prefix, last_used_at, revoked_at, created_at
  from public.institution_api_keys
  where (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin';

grant select on public.institution_api_keys_superadmin to authenticated;

-- ---------------------------------------------------------------------------
-- get_superadmin_accounts: the account list for all 3 staff roles (Physician,
-- Pharmacy, Facility Admin). profiles has no email column by design (see the
-- 0001 comment — role/status/etc. live here specifically because auth.users
-- isn't queryable under client RLS), so "contact" for these roles can only
-- come from auth.users.email, which is not exposed via any public-schema
-- table. SECURITY DEFINER is the standard, documented Supabase pattern for
-- this exact join — it runs as the function owner, which (unlike any client
-- role) has SELECT on auth.users. Patient accounts (self_check_accounts)
-- don't need this: that table has no email at all (phone is its own contact
-- field) and is already broadly authenticated-readable, so the app reads it
-- directly rather than through an RPC.
-- ---------------------------------------------------------------------------

create or replace function public.get_superadmin_accounts()
returns table (
  id uuid,
  role text,
  name text,
  title text,
  status text,
  institution text,
  created_at timestamptz,
  email text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'superadmin' then
    raise exception 'Superadmin role required.';
  end if;

  return query
    select p.id, p.role, p.name, p.title, p.status, p.institution, p.created_at, u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke all on function public.get_superadmin_accounts() from public;
grant execute on function public.get_superadmin_accounts() to authenticated;

-- ---------------------------------------------------------------------------
-- get_superadmin_prescription_activity: administrative metadata only — id,
-- timing, status, source, and who/who-for (resolved to names via profiles/
-- patients, both otherwise inaccessible to superadmin under RLS, which is
-- exactly why this runs SECURITY DEFINER). Deliberately excludes drugs,
-- verdicts, pharmacist_note, admin_note — the clinical/free-text columns.
-- ---------------------------------------------------------------------------

create or replace function public.get_superadmin_prescription_activity()
returns table (
  id uuid,
  created_at timestamptz,
  status text,
  source text,
  prescriber_id uuid,
  prescriber_name text,
  patient_id uuid,
  patient_name text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'superadmin' then
    raise exception 'Superadmin role required.';
  end if;

  return query
    select
      rx.id, rx.created_at, rx.status, rx.source,
      rx.prescriber_id, coalesce(pr.name, 'Unknown'),
      rx.patient_id, coalesce(pt.name, 'Unknown')
    from public.prescriptions rx
    left join public.profiles pr on pr.id = rx.prescriber_id
    left join public.patients pt on pt.id = rx.patient_id
    order by rx.created_at desc;
end;
$$;

revoke all on function public.get_superadmin_prescription_activity() from public;
grant execute on function public.get_superadmin_prescription_activity() to authenticated;

-- ---------------------------------------------------------------------------
-- get_superadmin_override_activity: that an override happened, on which
-- prescription, by whom, when — NOT which drug, NOT which verdict, NOT the
-- reason. Those three columns (drug_id, verdict_overridden, reason_text) are
-- exactly the "flagged drug/allergy conflict" content Super Admin must never
-- see.
-- ---------------------------------------------------------------------------

create or replace function public.get_superadmin_override_activity()
returns table (
  id uuid,
  "timestamp" timestamptz,
  user_id uuid,
  user_name text,
  prescription_id uuid
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'superadmin' then
    raise exception 'Superadmin role required.';
  end if;

  return query
    select ol.id, ol."timestamp", ol.user_id, coalesce(p.name, 'Unknown'), ol.prescription_id
    from public.override_logs ol
    left join public.profiles p on p.id = ol.user_id
    order by ol."timestamp" desc;
end;
$$;

revoke all on function public.get_superadmin_override_activity() from public;
grant execute on function public.get_superadmin_override_activity() to authenticated;

-- ---------------------------------------------------------------------------
-- get_superadmin_patient_check_activity: that a self-check happened, when,
-- for which (already-non-clinical) contact phone, and whether it was later
-- pulled into a pharmacy prescription — NOT the drugs/verdicts/profile JSON
-- columns, which carry the clinical content of the check itself.
-- ---------------------------------------------------------------------------

create or replace function public.get_superadmin_patient_check_activity()
returns table (
  id uuid,
  created_at timestamptz,
  phone text,
  pulled_into_prescription_id uuid
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'superadmin' then
    raise exception 'Superadmin role required.';
  end if;

  return query
    select pc.id, pc.created_at, pc.phone, pc.pulled_into_prescription_id
    from public.patient_checks pc
    order by pc.created_at desc;
end;
$$;

revoke all on function public.get_superadmin_patient_check_activity() from public;
grant execute on function public.get_superadmin_patient_check_activity() to authenticated;
