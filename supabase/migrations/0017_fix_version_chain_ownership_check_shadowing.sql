-- Fixes a real bug in 0016's prescriptions_insert_own policy, found during
-- live verification: EVERY insert with a non-null original_prescription_id
-- was being rejected by RLS, including entirely legitimate ones from the
-- owning prescriber via create_prescription_version().
--
-- Root cause: standard SQL correlated-subquery scoping, not an RLS
-- quirk. 0016 wrote:
--
--   exists (
--     select 1 from public.prescriptions p
--     where p.id = original_prescription_id and p.prescriber_id = auth.uid()
--   )
--
-- `p` aliases public.prescriptions, which itself has a column named
-- original_prescription_id — so the bare (unqualified) reference inside the
-- subquery's WHERE clause resolves to the INNERMOST matching column, p's
-- own original_prescription_id, not the outer new-row value the policy
-- meant to check. The condition silently became `p.id = p.original_
-- prescription_id` — a row's own id compared to its own original_
-- prescription_id column, which a real row can never satisfy (that column
-- points at a DIFFERENT row) — so the EXISTS was always false and every
-- such insert was rejected, ownership notwithstanding.
--
-- Fix: restructure so original_prescription_id appears exactly once in the
-- whole expression, with nothing in the subquery able to shadow it — the
-- subquery now selects only `id`, never original_prescription_id at all.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

drop policy if exists "prescriptions_insert_own" on public.prescriptions;
create policy "prescriptions_insert_own"
  on public.prescriptions for insert to authenticated
  with check (
    prescriber_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    and (
      original_prescription_id is null
      or original_prescription_id in (
        select id from public.prescriptions where prescriber_id = auth.uid()
      )
    )
  );
