-- Prescription versioning: an edit creates a new row linked to the
-- original rather than overwriting drugs/verdicts in place. Cancel is a
-- status flag ('cancelled'), never a hard delete.
--
-- Design (confirmed with the user, see the audit that preceded this):
-- each version is a REAL row with its own id, linked by two columns:
--   - original_prescription_id: null on the root version, otherwise
--     points at the ROOT (not the immediate predecessor) — "give me every
--     version" is one query (id = X or original_prescription_id = X), not
--     a recursive walk.
--   - superseded_by: set on the OLD row the instant a new version is
--     created; null means "this is the current version." No max(version_
--     number) aggregation needed anywhere to find the live one.
-- version_number is 1 on the root, incrementing per edit.
--
-- Each version keeping its own real id is the reason this design was
-- chosen over a separate prescription_versions table: dispense_records and
-- override_logs point at prescription_id, so an override/dispense stays
-- unambiguously attached to the EXACT version it was actually verified
-- against — editing a prescription after a pharmacist already
-- reviewed/overrode it never silently reattributes that history to the
-- edited content, because the old row's drugs/verdicts are never touched.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.prescriptions add column if not exists original_prescription_id uuid references public.prescriptions (id);
alter table public.prescriptions add column if not exists version_number int not null default 1;
alter table public.prescriptions add column if not exists superseded_by uuid references public.prescriptions (id);

create index if not exists prescriptions_original_prescription_id_idx on public.prescriptions (original_prescription_id);
create index if not exists prescriptions_superseded_by_idx on public.prescriptions (superseded_by);

-- Prevents two versions of the same chain from ever claiming the same
-- version_number — the actual race-safety backstop (see
-- access_requests_pending_email_idx, 0013, for the same reasoning: a DB
-- constraint is race-proof in a way a check-then-insert never is).
-- coalesce(original_prescription_id, id) groups a chain under its root's
-- own id, since the root itself has original_prescription_id = null.
create unique index if not exists prescriptions_version_chain_idx
  on public.prescriptions (coalesce(original_prescription_id, id), version_number);

alter table public.prescriptions drop constraint if exists prescriptions_status_check;
alter table public.prescriptions add constraint prescriptions_status_check
  check (status in (
    'draft', 'submitted', 'under_review', 'held', 'cleared', 'rejected', 'verified', 'dispensed', 'flagged', 'cancelled'
  ));

-- ---------------------------------------------------------------------------
-- RLS: close the two integrity gaps a naive client insert/update could open.
-- Neither is a data-visibility leak (ownership/institution scoping is
-- unaffected) — both are about not letting a client corrupt version-chain
-- integrity, same "Postgres enforces it, not just app code" standard
-- applied throughout this project.
-- ---------------------------------------------------------------------------

-- 1. original_prescription_id must actually belong to a chain the caller
--    owns — otherwise a client could raw-insert a row claiming to be a
--    version of someone else's prescription.
drop policy if exists "prescriptions_insert_own" on public.prescriptions;
create policy "prescriptions_insert_own"
  on public.prescriptions for insert to authenticated
  with check (
    prescriber_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    and (
      original_prescription_id is null
      or exists (
        select 1 from public.prescriptions p
        where p.id = original_prescription_id and p.prescriber_id = auth.uid()
      )
    )
  );

-- 2. superseded_by can only be set (by the prescriber themselves, via
--    create_prescription_version() below) while the row's status is still
--    editable — matches the editable-status list agreed with the user.
--    When superseded_by isn't being touched (status/note updates — the
--    overwhelming majority of writes through this policy), NEW.superseded_by
--    equals OLD.superseded_by and this check is a no-op either way.
drop policy if exists "prescriptions_update_own" on public.prescriptions;
create policy "prescriptions_update_own"
  on public.prescriptions for update to authenticated
  using (prescriber_id = auth.uid())
  with check (
    prescriber_id = auth.uid()
    and status <> 'dispensed'
    and (
      superseded_by is null
      or status in ('draft', 'submitted', 'under_review', 'held', 'flagged', 'rejected')
    )
  );

-- 3. A pharmacist never creates a version — that's prescriber-only, per the
--    user's explicit scoping. They can still update everything else
--    (status transitions, notes) on a prescription in their institution;
--    they just can never be the one who sets superseded_by.
drop policy if exists "prescriptions_update_institution_pharmacist" on public.prescriptions;
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
    and status <> 'dispensed'
    and superseded_by is null
  );

-- ---------------------------------------------------------------------------
-- create_prescription_version: atomically inserts the new version and marks
-- the old one superseded, so the two writes can never partially apply (the
-- exact class of bug 0015 just fixed for the dispense-status transition —
-- applying that lesson here up front rather than repeating it).
--
-- SECURITY INVOKER, not DEFINER, and granted to `authenticated` directly:
-- unlike dispense_drug() (0010), there's no untrusted-client-computation
-- concern to guard against here — screening verdicts are trusted-at-
-- creation-time the same way createPrescription already treats them (the
-- real enforcement gate is later, at pharmacist review/dispense, which
-- always re-screens fresh from real DB data regardless of what a
-- prescription row's own stored verdicts say). Running as the caller means
-- the insert/update below are fully subject to the RLS policies above with
-- no duplicated logic — the explicit checks in this function exist only for
-- a clear error message, not as the real enforcement (RLS is).
-- ---------------------------------------------------------------------------

create or replace function public.create_prescription_version(
  p_editing_id uuid,
  p_new_id uuid,
  p_drugs jsonb,
  p_verdicts jsonb,
  p_status text default 'submitted'
)
returns public.prescriptions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old public.prescriptions%rowtype;
  v_new public.prescriptions%rowtype;
  v_editable_statuses text[] := array['draft', 'submitted', 'under_review', 'held', 'flagged', 'rejected'];
begin
  select * into v_old from public.prescriptions where id = p_editing_id for update;
  if not found then
    raise exception 'Prescription not found or not visible to you.' using errcode = 'P0001';
  end if;
  if v_old.prescriber_id <> auth.uid() then
    raise exception 'Only the original prescriber can edit this prescription.' using errcode = 'P0002';
  end if;
  if v_old.superseded_by is not null then
    raise exception 'This is not the current version of this prescription — edit the current version instead.' using errcode = 'P0003';
  end if;
  if not (v_old.status = any(v_editable_statuses)) then
    raise exception 'A prescription with status "%" cannot be edited.', v_old.status using errcode = 'P0004';
  end if;
  if not (p_status = any(v_editable_statuses)) then
    raise exception 'New version status "%" is not a valid starting status for an edit.', p_status using errcode = 'P0005';
  end if;

  insert into public.prescriptions (
    id, patient_id, prescriber_id, drugs, verdicts, status, created_at,
    source, external_prescriber_name, patient_check_id, institution_id,
    original_prescription_id, version_number
  ) values (
    p_new_id, v_old.patient_id, v_old.prescriber_id, p_drugs, p_verdicts, p_status, now(),
    v_old.source, v_old.external_prescriber_name, v_old.patient_check_id, v_old.institution_id,
    coalesce(v_old.original_prescription_id, v_old.id), v_old.version_number + 1
  )
  returning * into v_new;

  update public.prescriptions set superseded_by = p_new_id where id = p_editing_id;

  return v_new;
end;
$$;

revoke all on function public.create_prescription_version(uuid, uuid, jsonb, jsonb, text) from public;
grant execute on function public.create_prescription_version(uuid, uuid, jsonb, jsonb, text) to authenticated;
