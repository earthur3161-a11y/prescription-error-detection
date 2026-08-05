-- Restores a condition 0022 silently dropped from prescriptions_insert_own.
--
-- Timeline: 0017 fixed a real correlated-subquery shadowing bug in this
-- policy so that a new version's original_prescription_id is actually
-- verified against a chain the caller owns (see 0017's own header for the
-- shadowing bug itself). 0022, working on something entirely unrelated
-- (restoring subscription/institution enforcement on inserts, silently
-- dropped by 0012), did `drop policy ... create policy` on this same
-- policy and rewrote its WITH CHECK from scratch to satisfy 0022's own
-- requirement — without carrying 0017's condition forward. The live policy
-- since 0022 has had NO original_prescription_id check at all: any
-- authenticated prescriber (their own prescriber_id, own institution,
-- correct subscription state) could set original_prescription_id to any
-- OTHER prescriber's real prescription id via a raw insert (bypassing
-- create_prescription_version(), which never lets a client supply this
-- value at all and is unaffected). Confirmed live before this migration:
-- select pg_get_expr(polwithcheck, polrelid) from pg_policy ... showed
-- exactly 0022's three conditions and nothing from 0017.
--
-- This is the third time in this project a policy drop/recreate has
-- silently dropped an unrelated, previously-fixed condition (pharmacist
-- visibility via the rogue 0008-removed policies; subscription enforcement
-- itself, 0006 -> silently dropped by 0012 -> restored by 0022; now this).
-- See the note added to AGENTS.md alongside this migration.
--
-- Fix: recreate the policy with BOTH 0022's institution/subscription gate
-- AND 0017's ownership-chain condition ANDed together — neither one
-- satisfies the other's purpose, both must hold. Reuses 0017's exact
-- subquery form (selects only `id`, never original_prescription_id) so the
-- original shadowing bug can't reoccur.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

drop policy if exists "prescriptions_insert_own" on public.prescriptions;
create policy "prescriptions_insert_own"
  on public.prescriptions for insert to authenticated
  with check (
    prescriber_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    and (
      (auth.jwt() -> 'app_metadata' ->> 'institution_id') is not null
      or exists (
        select 1 from public.subscriptions s
        where s.owner_id = auth.uid() and s.status = 'active' and s.period_end > now()
      )
    )
    and (
      original_prescription_id is null
      or original_prescription_id in (
        select id from public.prescriptions where prescriber_id = auth.uid()
      )
    )
  );
