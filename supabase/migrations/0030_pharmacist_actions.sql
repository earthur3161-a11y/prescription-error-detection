-- Moves pharmacist decisions (Approve/Hold/Reject/Request Clarification/
-- Record Intervention) off per-browser Dexie onto shared Postgres — the gap
-- AGENTS.md and 0019's own header comment both already documented:
-- "pharmacistActions still lives entirely in per-browser Dexie/IndexedDB,
-- unreachable from any server-side query." In practice this meant Request
-- Clarification was a dead end: the question a pharmacist wrote never left
-- their own browser, so the prescriber it was addressed to had no way to
-- ever see or respond to it, regardless of which account they used.
--
-- Also adds the one genuinely new capability this required: a
-- 'prescriber_response' action, insertable only by the prescriber who owns
-- the prescription, so the clarification loop (pharmacist asks -> prescriber
-- sees -> prescriber responds -> pharmacist sees the response) is real
-- end-to-end for the first time.
--
-- The `pharmacist_id` column name is kept as-is rather than renamed to
-- something role-neutral (e.g. actor_id) — for a prescriber_response row it
-- holds the responding PRESCRIBER's user id, not a pharmacist's. Not renamed
-- to avoid touching the parallel naming already established on
-- dispense_records/override_logs for a cosmetic-only change.
--
-- Select/insert policies mirror the current, twice-evolved shape of
-- override_logs' own policies (0002 -> 0004 own-only -> 0019 institution-
-- staff), not the original 0002 draft — read live before modeling on it, per
-- AGENTS.md's migration convention note. override_logs_select_own (0004) by
-- itself would NOT let a prescriber see a clarification request a pharmacist
-- wrote about their own prescription, so this table additionally needs a
-- "prescriber sees everything on their own prescriptions" policy that
-- override_logs has no equivalent of.
--
-- Apply via the Supabase Dashboard SQL Editor (or `supabase db push`). Safe
-- to re-run.

create table if not exists public.pharmacist_actions (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id),
  pharmacist_id uuid not null references auth.users (id),
  action text not null check (action in (
    'approve', 'dispense', 'reject', 'hold',
    'request_clarification', 'record_intervention', 'prescriber_response'
  )),
  reason text,
  clarification_drug_id text,
  intervention_outcome text,
  "timestamp" timestamptz not null default now()
);

create index if not exists pharmacist_actions_prescription_id_idx
  on public.pharmacist_actions (prescription_id);
create index if not exists pharmacist_actions_pharmacist_id_idx
  on public.pharmacist_actions (pharmacist_id);

alter table public.pharmacist_actions enable row level security;

-- --- SELECT ---

-- The acting user (pharmacist making a decision, or a prescriber who
-- responded) can always see their own rows.
drop policy if exists "pharmacist_actions_select_own" on public.pharmacist_actions;
create policy "pharmacist_actions_select_own"
  on public.pharmacist_actions for select to authenticated
  using (pharmacist_id = auth.uid());

-- The prescriber who owns the prescription can see EVERY action on it,
-- including ones a pharmacist wrote — without this, a request_clarification
-- a pharmacist creates would be invisible to the exact person it's for.
drop policy if exists "pharmacist_actions_select_prescriber_own_rx" on public.pharmacist_actions;
create policy "pharmacist_actions_select_prescriber_own_rx"
  on public.pharmacist_actions for select to authenticated
  using (
    exists (
      select 1 from public.prescriptions rx
      where rx.id = pharmacist_actions.prescription_id
        and rx.prescriber_id = auth.uid()
    )
  );

-- Institution-wide staff visibility (admin/pharmacist), same indirection and
-- same role/institution shape as override_logs_select_institution_staff
-- (0019) — pharmacist_actions has no institution_id of its own either.
drop policy if exists "pharmacist_actions_select_institution_staff" on public.pharmacist_actions;
create policy "pharmacist_actions_select_institution_staff"
  on public.pharmacist_actions for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'pharmacist')
    and (auth.jwt() -> 'app_metadata' ->> 'institution_id') is not null
    and exists (
      select 1 from public.prescriptions rx
      where rx.id = pharmacist_actions.prescription_id
        and rx.institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    )
  );

-- --- INSERT ---

-- Pharmacist decisions (everything except prescriber_response), scoped the
-- same way app/api/pharmacy/dispense/route.ts already scopes the dispense
-- gate in application code: same-institution staff, or an independent
-- pharmacist acting on their own walk-in (no institution, prescriber_id is
-- themselves).
drop policy if exists "pharmacist_actions_insert_pharmacist" on public.pharmacist_actions;
create policy "pharmacist_actions_insert_pharmacist"
  on public.pharmacist_actions for insert to authenticated
  with check (
    action <> 'prescriber_response'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist'
    and pharmacist_id = auth.uid()
    and exists (
      select 1 from public.prescriptions rx
      where rx.id = pharmacist_actions.prescription_id
        and (
          (
            (auth.jwt() -> 'app_metadata' ->> 'institution_id') is not null
            and rx.institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
          )
          or (
            (auth.jwt() -> 'app_metadata' ->> 'institution_id') is null
            and rx.institution_id is null
            and rx.prescriber_id = auth.uid()
          )
        )
    )
  );

-- The new capability: only the prescriber who owns the prescription may
-- write a prescriber_response, and only for their own prescription.
drop policy if exists "pharmacist_actions_insert_prescriber_response" on public.pharmacist_actions;
create policy "pharmacist_actions_insert_prescriber_response"
  on public.pharmacist_actions for insert to authenticated
  with check (
    action = 'prescriber_response'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'prescriber'
    and pharmacist_id = auth.uid()
    and exists (
      select 1 from public.prescriptions rx
      where rx.id = pharmacist_actions.prescription_id
        and rx.prescriber_id = auth.uid()
    )
  );

-- No update/delete policy at all — append-only, same as override_logs.
