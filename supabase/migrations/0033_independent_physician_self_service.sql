-- Independent physicians (prescriber role, no institution_id — no pharmacist
-- colleague to hand off to) get their own verify/approve capability, mirroring
-- what an independent pharmacist already has for their own walk-in
-- prescriptions since 0032. Institutional prescriptions are completely
-- unaffected — they still require an actual pharmacist's independent review,
-- exactly as 0032 requires. Also closes a real, unrelated bug found while
-- researching this: 'verified' is a 10th valid prescriptions.status value
-- that 0032's blocked-status list missed — it displays identically to
-- "Cleared" everywhere in the UI, so a plain physician could set it directly,
-- untouched by 0032's protection. Added to the same blocked list here.
--
-- Every condition 0032 already enforced is preserved verbatim below (per this
-- project's own documented convention for rewriting a policy on this exact
-- table) — this only ADDS 'verified' to the blocked list and ADDS one new
-- OR-branch, checking both the caller's own institution claim AND the row's
-- own institution_id (belt-and-suspenders — the row's institution_id is
-- already guaranteed to match the caller's claim at insert time via
-- prescriptions_insert_own, but checking both costs nothing and reads clearly).
--
-- Live-tested in rolled-back transactions against real demo accounts before
-- shipping: an institutional physician can no longer self-set 'verified' or
-- 'cleared' (0032 intact); an independent physician can now self-clear their
-- own prescription; an institutional physician still cannot own a batch or
-- self-clear even with the new branch present (no scope creep); both
-- institutional and independent pharmacist paths are completely unaffected.

drop policy if exists prescriptions_update_own on public.prescriptions;

create policy prescriptions_update_own on public.prescriptions
  for update
  using (prescriber_id = auth.uid())
  with check (
    (prescriber_id = auth.uid())
    and (status <> 'dispensed')
    and (
      (superseded_by is null)
      or (status = any (array['draft', 'submitted', 'under_review', 'held', 'flagged', 'rejected']))
    )
    and (
      status not in ('under_review', 'held', 'flagged', 'cleared', 'verified', 'rejected')
      or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist')
      or (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'prescriber'
        and (auth.jwt() -> 'app_metadata' ->> 'institution_id') is null
        and institution_id is null
      )
    )
  );

-- pharmacist_actions gets a role-of-actor column so a physician's own
-- self-decision is never indistinguishable, in the audit trail, from a
-- genuine independent pharmacist review of someone else's prescription.
-- Backfilled 'pharmacist' for every existing row — accurate: this capability
-- didn't exist before this migration, and this table currently has zero
-- prescriber_response rows to special-case (checked live).
alter table public.pharmacist_actions
  add column actor_role text not null default 'pharmacist' check (actor_role in ('pharmacist', 'prescriber'));

-- New, separate, narrowly-scoped policy — pharmacist_actions_insert_pharmacist
-- (the existing, already-proven policy) is left completely untouched.
create policy pharmacist_actions_insert_independent_physician_self on public.pharmacist_actions
  for insert
  with check (
    actor_role = 'prescriber'
    and action <> 'prescriber_response'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'prescriber'
    and (auth.jwt() -> 'app_metadata' ->> 'institution_id') is null
    and pharmacist_id = auth.uid()
    and exists (
      select 1 from public.prescriptions rx
      where rx.id = pharmacist_actions.prescription_id
        and rx.institution_id is null
        and rx.prescriber_id = auth.uid()
    )
  );

-- batches_insert_own: an independent physician can now own drug-stock batch
-- rows at all (previously hard-locked to role = 'pharmacist' — a prescriber
-- could not own or even list a single batch). batches_select_own and
-- batches_update_own already have no role check (ownership-only), so they
-- need no change — they'll work correctly the moment insert allows it.
-- An institutional physician remains blocked (live-tested) — this is scoped
-- to independent physicians only, matching prescriptions_update_own above.
drop policy if exists batches_insert_own on public.batches;

create policy batches_insert_own on public.batches
  for insert
  with check (
    (
      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist')
      or (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'prescriber'
        and (auth.jwt() -> 'app_metadata' ->> 'institution_id') is null
      )
    )
    and (owner_id = auth.uid())
    and (not (institution_id is distinct from ((auth.jwt() -> 'app_metadata' ->> 'institution_id'))::uuid))
  );
