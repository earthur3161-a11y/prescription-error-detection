-- Phase A: multi-tenancy foundation. Every authenticated RLS policy on
-- patients/prescriptions/override_logs today is a blanket `using (true)` —
-- confirmed against the actual policy text in 0002_phase2_clinical_data.sql
-- — meaning any authenticated account (any physician, any pharmacy, any
-- institution) can read and write every other account's patients and
-- prescriptions. This migration closes that gap by scoping ownership to the
-- acting account's own auth.uid(), reusing columns that already exist
-- (prescriptions.prescriber_id, override_logs.user_id — both already
-- correctly populated at every current write site) and adding the one that
-- doesn't (patients has no owner column today). Safe to re-run: every
-- statement is idempotent.

-- ---------------------------------------------------------------------------
-- patients: add an owner column.
-- ---------------------------------------------------------------------------

alter table public.patients add column if not exists owner_id uuid references auth.users (id);
create index if not exists patients_owner_id_idx on public.patients (owner_id);

-- One-time, targeted backfill for the live demo data seeded by
-- scripts/seed-supabase.ts (every seeded patient belongs to the demo
-- physician, ama.owusu@demo.mediguard.gh) — not a blind backfill of
-- unrelated real data, and a no-op if that account doesn't exist in this
-- project. Any other pre-existing patient row with no matching owner simply
-- becomes invisible under the new policies below rather than being deleted
-- or guessed at.
update public.patients
set owner_id = (select id from auth.users where email = 'ama.owusu@demo.mediguard.gh')
where owner_id is null
  and exists (select 1 from auth.users where email = 'ama.owusu@demo.mediguard.gh');

drop policy if exists "patients_select_authenticated" on public.patients;
drop policy if exists "patients_insert_authenticated" on public.patients;
drop policy if exists "patients_update_authenticated" on public.patients;

create policy "patients_select_own"
  on public.patients for select to authenticated
  using (owner_id = auth.uid());

create policy "patients_insert_own"
  on public.patients for insert to authenticated
  with check (owner_id = auth.uid());

create policy "patients_update_own"
  on public.patients for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- prescriptions: prescriber_id already exists, is not-null, and is already
-- always set to the acting account's own auth.uid() at every current write
-- site (PrescriptionBuilder, useCreatePrescription, the admin checkpoint's
-- re-upsert) — reuse it directly rather than adding a new column.
-- ---------------------------------------------------------------------------

drop policy if exists "prescriptions_select_authenticated" on public.prescriptions;
drop policy if exists "prescriptions_insert_authenticated" on public.prescriptions;
drop policy if exists "prescriptions_update_authenticated" on public.prescriptions;

create policy "prescriptions_select_own"
  on public.prescriptions for select to authenticated
  using (prescriber_id = auth.uid());

create policy "prescriptions_insert_own"
  on public.prescriptions for insert to authenticated
  with check (prescriber_id = auth.uid());

create policy "prescriptions_update_own"
  on public.prescriptions for update to authenticated
  using (prescriber_id = auth.uid())
  with check (prescriber_id = auth.uid());

-- ---------------------------------------------------------------------------
-- override_logs: user_id already exists and insert is already scoped
-- correctly (override_logs_insert_own) — only the SELECT policy needs
-- tightening from `using (true)`.
-- ---------------------------------------------------------------------------

drop policy if exists "override_logs_select_authenticated" on public.override_logs;

create policy "override_logs_select_own"
  on public.override_logs for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Known, deliberate side effect of this migration: the shared
-- Physician -> Facility Admin checkpoint -> Pharmacist queue pipeline
-- (admin/pipeline, pharmacist/queue) reads prescriptions authored by OTHER
-- accounts by design — that cross-account visibility is exactly the gap
-- this migration closes, so those pages will show empty for any account
-- other than the original prescriber until the pipeline itself is removed
-- (tracked separately). This is expected, not a regression to fix here.
-- ---------------------------------------------------------------------------
