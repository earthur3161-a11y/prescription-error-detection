-- Phase 1 Supabase migration: real Auth + Accounts + Access Requests.
--
-- Scope: only auth/account/access-request data moves here. Every other
-- MediGuard table (patients, prescriptions, formulary, pharmacy inventory,
-- audit/pipeline tables) stays in the browser's local Dexie/IndexedDB and is
-- untouched by this migration.
--
-- Apply via the Supabase Dashboard SQL Editor (or `supabase db push` if using
-- the CLI with this project linked). Safe to re-run: every statement is
-- idempotent (create-if-not-exists / drop-if-exists-then-create).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row. Service-role-write-only — role/
-- status/title are trust-bearing and must never be client-writable (a signed
-- -in user granting themselves 'superadmin' would be a privilege-escalation
-- bug). The authoritative role for RLS *decisions* is auth.jwt() ->
-- 'app_metadata' ->> 'role' (set only via the admin API); this table exists
-- so the app can list/join/display name, title, role, institution — data
-- that isn't queryable from auth.users under RLS.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('prescriber', 'pharmacist', 'admin', 'superadmin')),
  name text not null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  institution text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_superadmin" on public.profiles;
create policy "profiles_select_own_or_superadmin"
  on public.profiles
  for select
  using (
    id = auth.uid()
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin'
  );

-- Deliberately no insert/update/delete policy: only the service role (which
-- bypasses RLS entirely) can write here, via the approve-access-request
-- route and the demo seed script.

-- ---------------------------------------------------------------------------
-- access_requests: replaces the Dexie table, minus invite_token — Supabase's
-- own invite-link mechanism supersedes the app's hand-rolled token.
-- ---------------------------------------------------------------------------

create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  requested_role text not null check (requested_role in ('prescriber', 'pharmacist', 'admin')),
  institution text not null,
  license_number text,
  email text not null,
  phone text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  provisioned_account_id uuid references auth.users (id),
  rejection_reason text
);

create index if not exists access_requests_email_idx on public.access_requests (email);
create index if not exists access_requests_status_idx on public.access_requests (status);

-- Defense in depth: normalize email server-side even though the repository
-- layer already trims/lowercases before insert, so a future caller that
-- forgets to normalize can't create a case-variant duplicate.
create or replace function public.normalize_access_request_email()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists access_requests_normalize_email on public.access_requests;
create trigger access_requests_normalize_email
  before insert or update on public.access_requests
  for each row execute function public.normalize_access_request_email();

alter table public.access_requests enable row level security;

-- Public applicants can create a pending request and nothing else — they
-- cannot insert a row that's already approved/rejected, and (with no select
-- policy) cannot read back any request, including their own or others'.
drop policy if exists "access_requests_insert_public" on public.access_requests;
create policy "access_requests_insert_public"
  on public.access_requests
  for insert
  to anon, authenticated
  with check (status = 'pending');

drop policy if exists "access_requests_select_superadmin" on public.access_requests;
create policy "access_requests_select_superadmin"
  on public.access_requests
  for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

-- Lets reject() run as a plain client call under RLS. Approve still requires
-- the service-role server route, since it also has to create the auth user.
drop policy if exists "access_requests_update_superadmin" on public.access_requests;
create policy "access_requests_update_superadmin"
  on public.access_requests
  for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'superadmin');

-- No delete policy — access requests are never deleted, matching the
-- append-only-audit-trail pattern used elsewhere in this app.

-- ---------------------------------------------------------------------------
-- check_access_request_status: narrow, SECURITY DEFINER read for the public
-- "check my request status" flow. Returns only {status, rejection_reason}
-- for an exact email match — cannot be used to enumerate or browse requests.
-- Same privacy exposure as a typical "forgot password" form.
-- ---------------------------------------------------------------------------

create or replace function public.check_access_request_status(p_email text)
returns table (status text, rejection_reason text)
language sql
security definer
set search_path = public
stable
as $$
  select ar.status, ar.rejection_reason
  from public.access_requests ar
  where ar.email = lower(trim(p_email))
  order by ar.created_at desc
  limit 1;
$$;

revoke all on function public.check_access_request_status(text) from public;
grant execute on function public.check_access_request_status(text) to anon, authenticated;
