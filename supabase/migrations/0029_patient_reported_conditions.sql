-- Adds the column PrescriptionReasonSection.tsx / checkIndication.ts have
-- assumed existed since the earlier "reason for this prescription" feature
-- was built: nothing ever created reported_conditions on public.patients,
-- so patientRepository.updatePatient() silently dropped every write to it
-- (Postgres has no such column to update), and the chip toggle in the
-- Physician portal's new-prescription screen appeared to never select —
-- every save round-tripped, invalidated the patient query, refetched the
-- same row with no reported_conditions, and reverted.
--
-- jsonb, not text[], matching the existing allergies/active_medications
-- columns on this same table (0002_phase2_clinical_data.sql) — same
-- "array of structured-ish data, read back into a typed TS array" shape,
-- and keeps one storage convention for this table rather than mixing
-- jsonb and native Postgres arrays. No default: an absent value must stay
-- absent, not silently become '[]'::jsonb (see the column comment).
--
-- No RLS policy change needed — patients_update_own (or whichever policy is
-- currently live; see AGENTS.md's migration note on that history) is a
-- row-level check, not a column-level grant, so a new nullable column is
-- automatically covered by it.

alter table public.patients
  add column if not exists reported_conditions jsonb;

comment on column public.patients.reported_conditions is
  'Patient-reported reason(s) for treatment, from the curated PATIENT_CONDITIONS list (lib/patient-check/conditions.ts). Drives lib/screening-engine/checks/indicationCheck.ts. null/absent = not on file.';
