-- Phase B: the internal Physician -> Facility Admin checkpoint ->
-- Pharmacist queue pipeline is removed from the app entirely — this
-- migration drops the now-dead status/source values from the database
-- itself, not just the application code. Safe to re-run: every statement is
-- idempotent.
--
-- Constraints must be dropped BEFORE the data migration below, not after —
-- confirmed against the live table (conname prescriptions_source_check /
-- prescriptions_status_check, matching Postgres's default <table>_<column>
-- naming exactly). Renaming 'hospital' -> 'physician' while the *old*
-- source constraint (which only allows 'hospital') is still active fails
-- with "new row ... violates check constraint" — the UPDATE's target value
-- is what gets rejected, not the pre-existing stored value.

alter table public.prescriptions drop constraint if exists prescriptions_status_check;
alter table public.prescriptions drop constraint if exists prescriptions_source_check;

-- Existing rows: fold the removed statuses into the nearest still-valid
-- state now that the old constraint no longer blocks it.
update public.prescriptions set status = 'submitted' where status in ('pending_admin_review', 'pending_admin_cosign');

-- Existing rows: the old "hospital" source is renamed "physician" — same
-- meaning (a professional authored it directly), new name matching the
-- product's actual shape (an independent Physician Portal account, not
-- necessarily a hospital).
update public.prescriptions set source = 'physician' where source = 'hospital';

alter table public.prescriptions add constraint prescriptions_status_check
  check (status in (
    'draft', 'submitted', 'under_review', 'held', 'cleared', 'rejected', 'verified', 'dispensed', 'flagged'
  ));

alter table public.prescriptions add constraint prescriptions_source_check
  check (source in ('physician', 'patient_submitted', 'walk_in'));
