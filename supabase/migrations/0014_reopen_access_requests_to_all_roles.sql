-- Reverts 0006's admin-only tightening of access_requests.requested_role.
-- 0006 narrowed this to `= 'admin'` (NOT VALID) when physician/pharmacist
-- accounts moved to the self-serve subscription path — at the time, Path A
-- (access_requests + Super Admin approval) was believed to be exclusively
-- for Facility Admin onboarding.
--
-- Decision 2 (this session, 0012_institution_boundary.sql) reopens Path A
-- to institutional physicians and pharmacists too, coexisting with Path B
-- (the still-instant-activate /physician/signup, /pharmacy/signup route for
-- independent practitioners) — so the original 0001 constraint shape is
-- correct again. Without this, the /request-access role selector added
-- alongside 0012 fails on every non-admin submission with a raw constraint
-- violation.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

alter table public.access_requests drop constraint if exists access_requests_requested_role_check;
alter table public.access_requests add constraint access_requests_requested_role_check
  check (requested_role in ('prescriber', 'pharmacist', 'admin'));
