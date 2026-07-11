-- Phase 2 Supabase migration: core clinical data (patients, prescriptions,
-- override_logs, patient_checks).
--
-- Scope: these four tables move off per-browser Dexie/IndexedDB onto shared
-- Postgres, closing the gap where a real cross-device login (Phase 1) still
-- couldn't see clinical data written from another device. Pharmacy inventory
-- and admin/audit tables (clinical alerts, pipeline events) stay on Dexie —
-- deliberately out of scope, per the original phased plan (Phase 3/4).
--
-- Apply via the Supabase Dashboard SQL Editor (or `supabase db push` if using
-- the CLI with this project linked). Safe to re-run: every statement is
-- idempotent (create-if-not-exists / drop-if-exists-then-create).

-- ---------------------------------------------------------------------------
-- profiles: widen Phase 1's own-row-or-superadmin SELECT policy to any
-- authenticated user. Every clinical page that resolves a prescriber's or
-- pharmacist's name (audit trail, prescription detail, reports) now needs to
-- read *any* profile, not just its own — this is a shared clinical record
-- system with no per-user siloing anywhere in the app. Deliberately NOT
-- filtered by status = 'active': historical attribution must still resolve
-- names for staff who have since been disabled.
-- ---------------------------------------------------------------------------

drop policy if exists "profiles_select_own_or_superadmin" on public.profiles;
drop policy if exists "profiles_select_any_authenticated" on public.profiles;
create policy "profiles_select_any_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------

create table if not exists public.patients (
  id uuid primary key,
  name text not null,
  dob date not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  phone text,
  weight_kg numeric,
  renal_status text not null check (renal_status in ('normal', 'impaired', 'unknown')),
  hepatic_status text not null check (hepatic_status in ('normal', 'impaired', 'unknown')),
  -- null = "not on file" (must be treated as unknown, never as "confirmed
  -- none"); [] = confirmed, explicitly recorded as none. Mirrors the same
  -- invariant documented on Patient.allergies/activeMedications in
  -- lib/types.ts. NEVER add `default '[]'::jsonb` here — that would silently
  -- convert "not on file" into "confirmed none", exactly the bug class this
  -- column exists to prevent.
  allergies jsonb,
  active_medications jsonb,
  -- null = not on file / not applicable; true/false = confirmed.
  is_pregnant boolean,
  created_at timestamptz not null default now()
);

alter table public.patients enable row level security;

drop policy if exists "patients_select_authenticated" on public.patients;
create policy "patients_select_authenticated"
  on public.patients for select to authenticated using (true);

drop policy if exists "patients_insert_authenticated" on public.patients;
create policy "patients_insert_authenticated"
  on public.patients for insert to authenticated with check (true);

drop policy if exists "patients_update_authenticated" on public.patients;
create policy "patients_update_authenticated"
  on public.patients for update to authenticated using (true) with check (true);

-- No delete policy — no delete export exists in the repository layer today.

-- ---------------------------------------------------------------------------
-- prescriptions
-- ---------------------------------------------------------------------------

create table if not exists public.prescriptions (
  id uuid primary key,
  patient_id uuid not null references public.patients (id),
  prescriber_id uuid not null references auth.users (id),
  drugs jsonb not null,
  verdicts jsonb not null,
  status text not null check (status in (
    'draft', 'pending_admin_review', 'pending_admin_cosign', 'submitted',
    'under_review', 'held', 'cleared', 'rejected', 'verified', 'dispensed', 'flagged'
  )),
  created_at timestamptz not null,
  pharmacist_note text,
  admin_note text,
  source text not null check (source in ('hospital', 'patient_submitted', 'walk_in')),
  external_prescriber_name text,
  -- No FK to patient_checks(id): a patient-submitted prescription is created
  -- referencing an already-existing check, so that direction is always safe,
  -- but there is no ordering guarantee in the other direction (see below).
  patient_check_id uuid
);

create index if not exists prescriptions_patient_id_idx on public.prescriptions (patient_id);
create index if not exists prescriptions_prescriber_id_idx on public.prescriptions (prescriber_id);
create index if not exists prescriptions_status_idx on public.prescriptions (status);

alter table public.prescriptions enable row level security;

drop policy if exists "prescriptions_select_authenticated" on public.prescriptions;
create policy "prescriptions_select_authenticated"
  on public.prescriptions for select to authenticated using (true);

drop policy if exists "prescriptions_insert_authenticated" on public.prescriptions;
create policy "prescriptions_insert_authenticated"
  on public.prescriptions for insert to authenticated with check (true);

drop policy if exists "prescriptions_update_authenticated" on public.prescriptions;
create policy "prescriptions_update_authenticated"
  on public.prescriptions for update to authenticated using (true) with check (true);

-- No delete policy.

-- ---------------------------------------------------------------------------
-- override_logs: append-only (mirrors the repository's own "no update/delete
-- export" comment as an RLS guarantee). Deliberately NO foreign key from
-- prescription_id to prescriptions(id): the prescription workspace lets a
-- prescriber log an override for a not-yet-submitted prescription (the
-- override write can happen before the parent prescription row exists), so a
-- FK here would reject a write pattern the app has always supported under
-- Dexie's lack of referential integrity.
-- ---------------------------------------------------------------------------

create table if not exists public.override_logs (
  id uuid primary key,
  prescription_id uuid not null,
  drug_id text not null,
  verdict_overridden text not null check (verdict_overridden in ('caution', 'blocked')),
  reason_code text not null check (reason_code in (
    'benefit_outweighs_risk', 'verified_with_pharmacist', 'patient_tolerates_combination', 'other'
  )),
  reason_text text not null,
  user_id uuid not null references auth.users (id),
  "timestamp" timestamptz not null
);

create index if not exists override_logs_prescription_id_idx on public.override_logs (prescription_id);
create index if not exists override_logs_user_id_idx on public.override_logs (user_id);

alter table public.override_logs enable row level security;

drop policy if exists "override_logs_select_authenticated" on public.override_logs;
create policy "override_logs_select_authenticated"
  on public.override_logs for select to authenticated using (true);

-- Closes an impersonation gap for free: a caller can only log an override as
-- themselves. PrescriptionBuilder.tsx already always sets userId from the
-- session, so this doesn't change any existing behavior.
drop policy if exists "override_logs_insert_own" on public.override_logs;
create policy "override_logs_insert_own"
  on public.override_logs for insert to authenticated with check (user_id = auth.uid());

-- No update/delete policy — permanent once logged, per the append-only audit
-- trail requirement.

-- ---------------------------------------------------------------------------
-- patient_checks: the anonymous Patient Self-Check flow. No anonymous SELECT
-- policy at all, even though inserts are anonymous — a lookup-by-id/token
-- RLS policy permissive enough for a narrow .eq() is also permissive enough
-- for a full-table scan, so lookups go through the two narrow SECURITY
-- DEFINER RPCs below instead.
-- ---------------------------------------------------------------------------

create table if not exists public.patient_checks (
  id uuid primary key,
  created_at timestamptz not null,
  drugs jsonb not null,
  -- Stored as one opaque object (not decomposed into separate defaulted
  -- columns), so the null-vs-[] "not on file" convention on the nested
  -- profile.allergies/profile.activeMedications fields is preserved exactly
  -- as-is by PostgREST's JSON round-trip — there is no column-level default
  -- that could silently rewrite it.
  profile jsonb not null,
  verdicts jsonb not null,
  share_token text not null,
  -- No FK to prescriptions(id): set later via markPatientCheckPulled, once
  -- pulled into a real prescription.
  pulled_into_prescription_id uuid
);

create unique index if not exists patient_checks_share_token_idx on public.patient_checks (share_token);
create index if not exists patient_checks_created_at_idx on public.patient_checks (created_at);

alter table public.patient_checks enable row level security;

-- The self-check flow is genuinely anonymous.
drop policy if exists "patient_checks_insert_any" on public.patient_checks;
create policy "patient_checks_insert_any"
  on public.patient_checks for insert to anon, authenticated with check (true);

-- For the compliance center (listPatientChecks()) and the audit event feed —
-- broad, but authenticated-only; anon has no select policy at all here.
drop policy if exists "patient_checks_select_authenticated" on public.patient_checks;
create policy "patient_checks_select_authenticated"
  on public.patient_checks for select to authenticated using (true);

-- markPatientCheckPulled is called from an already-RoleGuard-gated
-- pharmacist route, not the anonymous flow.
drop policy if exists "patient_checks_update_authenticated" on public.patient_checks;
create policy "patient_checks_update_authenticated"
  on public.patient_checks for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- get_patient_check_by_id / get_patient_check_by_share_token: narrow,
-- SECURITY DEFINER, exact-match-only reads for the anonymous "pull up my
-- check" flow — mirrors check_access_request_status's shape. The id/token
-- themselves are the entire access-control mechanism (see the crypto
-- .randomUUID() comment in app/check/new/page.tsx), so these functions never
-- return more than the one matching row.
-- ---------------------------------------------------------------------------

create or replace function public.get_patient_check_by_id(p_id uuid)
returns table (
  id uuid,
  created_at timestamptz,
  drugs jsonb,
  profile jsonb,
  verdicts jsonb,
  share_token text,
  pulled_into_prescription_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select id, created_at, drugs, profile, verdicts, share_token, pulled_into_prescription_id
  from public.patient_checks
  where id = p_id;
$$;

revoke all on function public.get_patient_check_by_id(uuid) from public;
grant execute on function public.get_patient_check_by_id(uuid) to anon, authenticated;

create or replace function public.get_patient_check_by_share_token(p_token text)
returns table (
  id uuid,
  created_at timestamptz,
  drugs jsonb,
  profile jsonb,
  verdicts jsonb,
  share_token text,
  pulled_into_prescription_id uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select id, created_at, drugs, profile, verdicts, share_token, pulled_into_prescription_id
  from public.patient_checks
  where share_token = p_token;
$$;

revoke all on function public.get_patient_check_by_share_token(text) from public;
grant execute on function public.get_patient_check_by_share_token(text) to anon, authenticated;
