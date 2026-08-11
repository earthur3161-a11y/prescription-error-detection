-- Scope custom_drugs the same way 0027 scoped profiles, plus let independent
-- prescribers/pharmacists (no institution — see PortalSignupForm.tsx, which
-- creates accounts with no institution field at all) manage their own drugs,
-- something only the Facility Admin role could do until now.
--
-- Current live policies being replaced (0026_custom_drugs.sql):
--   custom_drugs_select_authenticated: using (true) — every custom drug
--     visible platform-wide, admin-added or not, regardless of institution.
--   custom_drugs_insert_admin: role = 'admin' and owner_id = auth.uid() —
--     only Facility Admin can add a custom drug at all. An independent
--     prescriber/pharmacist (no admin role, no institution) had no path to
--     add one of their own.
--   custom_drugs_delete_own_admin: role = 'admin' and owner_id = auth.uid()
--     — same admin-only restriction on delete.
--
-- New model:
--   - institution_id (new column, nullable) — null for an independent
--     practitioner's own drug, set for a Facility Admin's institution-wide
--     addition. Backfilled from the owner's own profile below so every
--     existing admin-added drug keeps working for that institution's staff
--     — without this backfill every current row would go to institution_id
--     null and become invisible to everyone but its original adder.
--   - SELECT: visible to its owner, or to same-institution staff when
--     institution_id is set. An independent's drug (institution_id null)
--     is therefore visible only to them, matching "their own medicine
--     database, managed by themselves" — while an admin's institution-wide
--     addition keeps reaching their own institution's prescribers/
--     pharmacists exactly as before, just no longer leaking to every other
--     institution on the platform too.
--   - INSERT: admin adding to their own institution (unchanged in effect,
--     narrower in scope than before), OR an independent prescriber/
--     pharmacist (no institution claim) adding a row with institution_id
--     left null. An institution-affiliated prescriber/pharmacist still
--     cannot add directly — that stays their Facility Admin's job, same
--     as today; the new capability is specifically for practitioners who
--     have no admin of their own.
--   - DELETE: owner_id = auth.uid(), full stop — simpler than the old
--     admin-only rule since non-admin owners exist now too. A row's owner
--     never changes after insert, so this is exactly as narrow as before
--     for admin-added rows and correctly extends the same "only who added
--     it" rule to independent-added rows.
--
-- Every current reader of this table was checked before narrowing SELECT
-- (see the accompanying app changes in this commit): the client read path
-- (lib/data/repositories/drugRepository.ts) already goes through RLS with
-- no filtering of its own, so it's automatically correct once this policy
-- changes. The three server-side paths that read via the service role
-- (bypasses RLS entirely) — /api/v1/screen, /cds-services/mediguard-screen,
-- /api/pharmacy/dispense — are updated in the same commit to pass an
-- explicit scope into getCustomDrugs(), since a service-role query has no
-- RLS to fall back on for this new distinction.

alter table public.custom_drugs add column if not exists institution_id uuid;

update public.custom_drugs cd
set institution_id = p.institution_id
from public.profiles p
where p.id = cd.owner_id
  and cd.institution_id is distinct from p.institution_id;

drop policy if exists "custom_drugs_select_authenticated" on public.custom_drugs;
create policy "custom_drugs_select_own_or_institution"
  on public.custom_drugs for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      institution_id is not null
      and institution_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'institution_id'::text))::uuid
    )
  );

drop policy if exists "custom_drugs_insert_admin" on public.custom_drugs;
create policy "custom_drugs_insert_admin_or_independent"
  on public.custom_drugs for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      (
        ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'
        and institution_id is not null
        and institution_id = (((auth.jwt() -> 'app_metadata'::text) ->> 'institution_id'::text))::uuid
      )
      or (
        ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['prescriber'::text, 'pharmacist'::text])
        and ((auth.jwt() -> 'app_metadata'::text) ->> 'institution_id'::text) is null
        and institution_id is null
      )
    )
  );

drop policy if exists "custom_drugs_delete_own_admin" on public.custom_drugs;
create policy "custom_drugs_delete_own"
  on public.custom_drugs for delete to authenticated
  using (owner_id = auth.uid());
