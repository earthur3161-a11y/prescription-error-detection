-- Closes the resubmission gap flagged during Phase G verification:
-- access_requests.email had only a plain, non-unique index, so nothing
-- stopped two PENDING requests coexisting for the same email (either an
-- accidental double-submit, or two concurrent submissions racing each
-- other). A rejected request must still allow resubmission — this only
-- blocks a second PENDING request while one is already pending.
--
-- Enforced as a unique partial index, not an application-level
-- check-then-insert: a check-then-insert has a TOCTOU race window (two
-- near-simultaneous submissions can both pass the check before either
-- commits its insert), which is exactly the case this needs to be correct
-- under. A partial unique index makes Postgres itself the single point of
-- enforcement, atomically, regardless of how many requests arrive at once.
-- The application layer (accessRequestRepository.createAccessRequest) still
-- catches the resulting unique-violation and turns it into a friendly
-- message — the index is the correctness guarantee, the app-level catch is
-- purely presentational.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

create unique index if not exists access_requests_pending_email_idx
  on public.access_requests (email)
  where status = 'pending';
