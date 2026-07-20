-- Closes a live cross-tenant leak discovered via Supabase's own security/
-- performance advisors after Phase D: patients/prescriptions carried 5 extra
-- RLS policies (patients_select_institution_pharmacist,
-- patients_select_institution_prescriber_analytics,
-- prescriptions_select_institution_staff,
-- prescriptions_select_institution_prescriber_analytics,
-- prescriptions_update_institution_pharmacist) that were never created by
-- any migration in this repo — applied directly to the live database at
-- some point outside version control, predating the Phase A-D pivot to
-- three independent, isolated products.
--
-- They scoped access by matching profiles.institution, a free-text display
-- field (never intended as a security boundary — see the "so the app can
-- list/join/display" comment in 0001_phase1_auth.sql) via plain string
-- equality. Since RLS policies are OR'd together, this ran ALONGSIDE Phase
-- A's owner_id-scoped policies, silently re-opening exactly the isolation
-- gap Phase A was built to close: any two accounts whose free-text
-- institution happened to match (confirmed live: all 3 demo accounts share
-- "Korle Bu Teaching Hospital") could read each other's patients/
-- prescriptions, and a pharmacist could even UPDATE another prescriber's
-- prescriptions. This is a plain security fix, not a refactor.
--
-- Known, accepted side effect: /admin/analytics (Facility Analytics) reads
-- via plain usePrescriptions()/usePatients() with no filters, and relied
-- entirely on prescriptions_select_institution_staff to see any prescriber's
-- data at all (an admin never authors prescriptions themselves, so
-- prescriptions_select_own alone shows nothing). That page will show empty
-- state for admin accounts until it's rebuilt against real institution_id-
-- scoped data (Facility Admins don't have any persisted prescription
-- history in the new model yet - /api/v1/screen doesn't write one). Tracked
-- as explicit follow-up work, not fixed in this migration.

drop policy if exists "patients_select_institution_pharmacist" on public.patients;
drop policy if exists "patients_select_institution_prescriber_analytics" on public.patients;
drop policy if exists "prescriptions_select_institution_staff" on public.prescriptions;
drop policy if exists "prescriptions_select_institution_prescriber_analytics" on public.prescriptions;
drop policy if exists "prescriptions_update_institution_pharmacist" on public.prescriptions;
