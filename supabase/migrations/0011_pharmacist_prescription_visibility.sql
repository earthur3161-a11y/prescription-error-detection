-- Restores pharmacist (and admin) visibility into prescriptions/patients
-- they didn't personally create — a real, live gap discovered while
-- verifying the dispense gate (0010): 0004_multitenancy_foundation.sql
-- scoped SELECT to owner_id/prescriber_id = auth.uid() to close a genuine
-- cross-tenant leak, and 0008_close_institution_text_leak.sql later removed
-- the (separately-buggy, free-text-institution-matching) policies that had
-- been the only thing letting a pharmacist see a physician's prescriptions
-- at all. Net effect confirmed live: a real pharmacist session gets
-- `status: 200, data: null` for any prescription it didn't author — which,
-- structurally, is every prescription, since pharmacists never author one.
-- This broke Review, Dispense, the Prescriptions list, and Reports.
--
-- The fix here is role-based (auth.jwt() -> 'app_metadata' ->> 'role'),
-- the same mechanism 0009's superadmin policies already use — not the
-- institution free-text match 0008 correctly killed, so this does not
-- reopen that leak.
--
-- Scope: SELECT for pharmacist + admin on patients and prescriptions.
-- Additionally, UPDATE for pharmacist only on prescriptions — SELECT alone
-- isn't sufficient to make Review/Dispense actually work: every action on
-- those pages (approve, hold, reject, mark dispensed, save a pharmacist
-- note) is a status/field UPDATE on a prescription the pharmacist doesn't
-- own, which prescriptions_update_own (still scoped to prescriber_id =
-- auth.uid()) also blocks. Admin gets no UPDATE grant here — nothing in the
-- current app has an admin account writing to a prescription — and neither
-- role gets UPDATE on patients, since pharmacists don't edit patient
-- demographic data in this workflow.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.
--
-- ---------------------------------------------------------------------------
-- KNOWN LIMITATION (tracked, not a bug to silently fix later — see AGENTS.md
-- "Known architectural limitations" for the durable copy of this note):
--
-- This grants pharmacist/admin visibility system-wide, with no institution
-- boundary — patients and prescriptions have no institution_id column, and
-- pharmacist/physician JWTs carry no institution_id claim. This is believed
-- correct for the current single-pharmacy internal workflow model (separate
-- from the multi-tenant Facility Admin/API-key product surface). IF this
-- product ever needs multiple independent pharmacies/institutions on the
-- INTERNAL workflow, this policy needs real institution_id scoping — new
-- column on both tables, backfill, and extending provisioning to give
-- physicians/pharmacists an institution_id claim too.
-- ---------------------------------------------------------------------------

drop policy if exists "patients_select_pharmacist_admin" on public.patients;
create policy "patients_select_pharmacist_admin"
  on public.patients for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('pharmacist', 'admin'));

drop policy if exists "prescriptions_select_pharmacist_admin" on public.prescriptions;
create policy "prescriptions_select_pharmacist_admin"
  on public.prescriptions for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('pharmacist', 'admin'));

drop policy if exists "prescriptions_update_pharmacist" on public.prescriptions;
create policy "prescriptions_update_pharmacist"
  on public.prescriptions for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist');
