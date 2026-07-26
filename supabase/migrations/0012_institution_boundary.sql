-- Phase G: the real institution boundary. Adds institution_id to patients,
-- prescriptions, and profiles, and replaces 0011's global pharmacist/admin
-- visibility with real per-institution scoping.
--
-- Design: institution_id is set ONCE, at row-creation time, from the
-- creating user's own JWT claim — never trusted as a bare client-supplied
-- value. Every INSERT policy's WITH CHECK now also requires
-- "institution_id IS NOT DISTINCT FROM the caller's own institution_id
-- claim" — an institutional user can only ever insert rows tagged with
-- their own institution, and an independent user (no claim) can only ever
-- insert rows with institution_id NULL. A client that tries to lie about
-- either is rejected by Postgres itself, not just the app's own code.
--
-- Two account populations, by design (Decision 2, confirmed with the user):
--   - Institutional staff (pharmacist/admin, and now prescriber too, when
--     provisioned via the access_requests + Super Admin approval path):
--     institution_id claim present -> see only their own institution's data.
--   - Independent physicians/pharmacists (the instant-activate
--     /physician/signup, /pharmacy/signup path) and physicians in general
--     for their own patients: NO institution_id claim -> scoped to
--     owner_id/prescriber_id = auth.uid(), same as before, invisible to
--     every institution's staff and to each other.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Schema: add institution_id everywhere it needs to exist from now on.
-- ---------------------------------------------------------------------------

alter table public.patients add column if not exists institution_id uuid references public.institutions (id);
alter table public.prescriptions add column if not exists institution_id uuid references public.institutions (id);
alter table public.profiles add column if not exists institution_id uuid references public.institutions (id);

create index if not exists patients_institution_id_idx on public.patients (institution_id);
create index if not exists prescriptions_institution_id_idx on public.prescriptions (institution_id);
create index if not exists profiles_institution_id_idx on public.profiles (institution_id);

-- ---------------------------------------------------------------------------
-- patients: replace 0011's global pharmacist/admin policy with real
-- institution scoping. owner-scoped SELECT (0004) is untouched — an
-- independent physician still sees their own patients regardless of this
-- change.
-- ---------------------------------------------------------------------------

drop policy if exists "patients_select_pharmacist_admin" on public.patients;
create policy "patients_select_institution_staff"
  on public.patients for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('pharmacist', 'admin')
    and institution_id is not null
    and institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own"
  on public.patients for insert to authenticated
  with check (
    owner_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- prescriptions: same replacement, plus the pharmacist UPDATE policy (also
-- from 0011) needs the identical institution scoping — SELECT alone doesn't
-- let a pharmacist actually approve/dispense.
-- ---------------------------------------------------------------------------

drop policy if exists "prescriptions_select_pharmacist_admin" on public.prescriptions;
create policy "prescriptions_select_institution_staff"
  on public.prescriptions for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('pharmacist', 'admin')
    and institution_id is not null
    and institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

drop policy if exists "prescriptions_update_pharmacist" on public.prescriptions;
create policy "prescriptions_update_institution_pharmacist"
  on public.prescriptions for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist'
    and institution_id is not null
    and institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist'
    and institution_id is not null
    and institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

drop policy if exists "prescriptions_insert_own" on public.prescriptions;
create policy "prescriptions_insert_own"
  on public.prescriptions for insert to authenticated
  with check (
    prescriber_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- KNOWN LIMITATION (tracked, not a bug to silently fix later — see AGENTS.md
-- "Known architectural limitations" for the durable copy of this note):
--
-- dispense_records/batches (0010) and override_logs (0002/0004) still carry
-- no institution_id and are not scoped by it — they're reachable today only
-- through prescription_id/patient_id, which ARE now institution-scoped
-- indirectly (a pharmacist can only load a dispense_records row for a
-- prescription they can already see). Direct institution_id columns on
-- these two tables would close that indirection but weren't required to
-- make the boundary itself hold, and are deferred rather than done blind.
-- ---------------------------------------------------------------------------
