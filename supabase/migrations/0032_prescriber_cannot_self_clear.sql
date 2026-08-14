-- Closes a self-verification gap: prescriptions_update_own had no role
-- check, so a prescriber (physician) who owns a prescription could
-- transition its own status straight to 'cleared' (or 'under_review',
-- 'held', 'flagged', 'rejected') with no independent pharmacist review —
-- reachable today by navigating directly to /pharmacist/review/[id] for
-- their own prescription. The pharmacist_actions audit-log INSERT already
-- correctly rejected this (role-checked, 0030_pharmacist_actions.sql), but
-- the prescriptions.status UPDATE itself did not, leaving an inconsistent
-- record: a "cleared" status with no matching approve action ever logged.
--
-- Per AGENTS.md's own documented convention for this exact class of
-- migration: every condition the live policy enforced (read via
-- pg_get_expr, not just the prior migration file) is preserved verbatim
-- below, ANDed with one new condition — nothing removed, nothing assumed
-- implicit. Live-tested against real demo accounts in a rolled-back
-- transaction before shipping: (1) a prescriber can no longer self-clear
-- their own prescription; (2) a prescriber can still submit/cancel their
-- own prescription (unaffected — those aren't in the blocked list); (3) an
-- institutional pharmacist can still clear/reject any prescription at their
-- institution, unaffected — prescriptions_update_institution_pharmacist is
-- untouched and already covers this independently; (4) an independent
-- pharmacist (no institution) can still self-review their own walk-in
-- prescription via this policy's new OR-pharmacist fallback, the one case
-- that specifically depends on this change rather than the sibling policy.

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
    -- New: the five pharmacist-decision statuses require the actor to
    -- actually be a pharmacist. draft/submitted/cancelled (a prescriber's
    -- own legitimate self-service actions) are unaffected — not in this list.
    and (
      status not in ('under_review', 'held', 'flagged', 'cleared', 'rejected')
      or ((auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist')
    )
  );
