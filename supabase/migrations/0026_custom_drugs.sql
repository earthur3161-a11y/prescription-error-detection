-- Admin Formulary Management: moves admin-added custom drugs off per-browser
-- Dexie onto shared Postgres, and makes them reachable by the server-side
-- screening paths (/api/v1/screen, CDS Hooks, the dispense gate's re-screen)
-- that read the static formulary directly and have never seen anything an
-- admin added.
--
-- Deliberately scoped to ADD/DELETE of admin-added drugs only, matching
-- exactly what the existing UI already does (app/(app)/admin/formulary/
-- page.tsx has no edit-in-place for an existing drug's fields, and the
-- bulk-import flow only ever adds new rows, never modifies existing ones).
-- This does NOT touch the 144+ base Ghana STG/EML-sourced drugs in
-- lib/formulary/ghana/, which remain code-committed, code-reviewed, and
-- immutable via this UI — a deliberate safety property, not a limitation:
-- a button click should never be able to alter or delete a sourced clinical
-- reference record.
--
-- Full Drug shape stored as jsonb (matches drugs/verdicts on prescriptions,
-- allergies/active_medications on patients — the existing pattern for rich,
-- nested objects with no query need on individual sub-fields).
--
-- RLS: broad-authenticated SELECT (the whole formulary must be visible to
-- every clinical role for screening — matches how the base formulary has no
-- institution concept at all). INSERT and DELETE are admin-only and
-- owner-scoped (only your own additions) — narrower than "any admin can
-- touch any custom drug," which the old Dexie-only feature never actually
-- supported either (each browser only ever saw its own local edits), so
-- this doesn't expand what admins could already effectively do. No UPDATE
-- policy: both current write paths (the add-drug form, CSV import) always
-- generate a fresh id and never revise an existing row.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

create table if not exists public.custom_drugs (
  id text primary key,
  drug jsonb not null,
  owner_id uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists custom_drugs_created_at_idx on public.custom_drugs (created_at);

alter table public.custom_drugs enable row level security;

drop policy if exists "custom_drugs_select_authenticated" on public.custom_drugs;
create policy "custom_drugs_select_authenticated"
  on public.custom_drugs for select to authenticated using (true);

drop policy if exists "custom_drugs_insert_admin" on public.custom_drugs;
create policy "custom_drugs_insert_admin"
  on public.custom_drugs for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and owner_id = auth.uid()
  );

drop policy if exists "custom_drugs_delete_own_admin" on public.custom_drugs;
create policy "custom_drugs_delete_own_admin"
  on public.custom_drugs for delete to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and owner_id = auth.uid()
  );
