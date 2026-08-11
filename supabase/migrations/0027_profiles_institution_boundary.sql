-- Scope public.profiles SELECT to the viewer's own institution (plus their
-- own row always, plus Super Admin seeing everyone platform-wide).
--
-- Current live policy being replaced (profiles_select_any_authenticated,
-- 0002_phase2_clinical_data.sql): using (true) — any authenticated user can
-- read every profile row, no institution boundary at all. That was correct
-- when it was written: 0002 predates multitenancy entirely ("no per-user
-- siloing anywhere in the app" per its own comment). 0004/0012/0020 later
-- added institution boundaries to patients/prescriptions/pharmacy tables,
-- but profiles was never revisited — a real gap, not a deliberate design
-- choice: e.g. Settings > Users in the Physician portal currently lists
-- every account at every institution on the platform, not just the
-- viewer's own facility.
--
-- Condition explicitly preserved from 0002's own comment: still NOT filtered
-- by status = 'active' — historical attribution must keep resolving names
-- for staff who have since been disabled, same as before.
--
-- Verified every existing profiles reader before narrowing this (see
-- lib/query/hooks/useProfiles.ts's callers): each one only ever resolves
-- either the viewer's own profile, or a profile belonging to the same
-- institution's data (prescriptions/patients/dispenses are already
-- institution-scoped by their own RLS, e.g. prescriptions_select_institution_
-- staff), so none of them relied on the cross-institution access being
-- removed here. admin/audit-log/page.tsx was already working around this
-- exact gap with its own client-side institutionId filter (now redundant,
-- left in place harmlessly). The Super Admin accounts page does not use this
-- table at all (useSuperAdminAccounts, a separate service-role-backed path),
-- so is unaffected either way.

drop policy if exists "profiles_select_any_authenticated" on public.profiles;
create policy "profiles_select_institution_or_own"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'superadmin'
    or (
      institution_id is not null
      and institution_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'institution_id'::text))::uuid
    )
  );
