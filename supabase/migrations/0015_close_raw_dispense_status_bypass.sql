-- Closes a real dispense-gate bypass found while auditing prescription
-- versioning: app/(app)/prescriptions/[id]/page.tsx had a "Verify &
-- Dispense" button that called updatePrescriptionStatus(id, "dispensed")
-- directly — a raw RLS-gated update, with no call to the real
-- /api/pharmacy/dispense route at all. No re-screening, no stock
-- check/decrement, no dispense_records audit row, no override enforcement.
-- The frontend fix (this same change set) removes that button. This
-- migration closes the same hole at the DB layer too, as a second,
-- independent layer — consistent with how dispense_drug() is already
-- service_role-only so a browser session can never call it directly.
--
-- Two parts:
--   1. dispense_drug() now also flips prescriptions.status to 'dispensed'
--      itself, atomically, in the same transaction as the stock decrement
--      and dispense_records insert. Previously this was left to a SEPARATE,
--      non-atomic client-side call after the RPC succeeded — which
--      necessarily meant a pharmacist's own RLS-gated session had to be
--      *allowed* to set status = 'dispensed' via a raw update, which is
--      exactly the permission the button above was able to (ab)use directly
--      without ever calling the RPC at all.
--   2. Now that nothing legitimate needs a client-side path to
--      status = 'dispensed' anymore, both prescriptions UPDATE policies a
--      pharmacist can act through (prescriptions_update_own — covers an
--      independent pharmacist's own walk-in entries; and
--      prescriptions_update_institution_pharmacist) have their WITH CHECK
--      tightened to reject it. The only way prescriptions.status can become
--      'dispensed' now is through dispense_drug(), running as service_role.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

create or replace function public.dispense_drug(
  p_prescription_id uuid,
  p_patient_id uuid,
  p_pharmacist_id uuid,
  p_batch_id uuid,
  p_drug_id text,
  p_drug_name text,
  p_quantity integer,
  p_partial_dispense_reason text,
  p_screening_verdict text,
  p_screening_flags jsonb,
  p_screened_at timestamptz,
  p_override_note text
)
returns public.dispense_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.batches%rowtype;
  v_record public.dispense_records%rowtype;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be positive.';
  end if;

  if p_screening_verdict <> 'safe' and (
    p_override_note is null
    or length(trim(p_override_note)) < 10
    or lower(trim(p_override_note)) in (
      'ok', 'okay', 'na', 'n/a', 'none', 'no', 'yes', '-', '--', 'fine', 'proceed', 'approved', 'confirmed'
    )
  ) then
    raise exception 'A genuine override note is required for a % screening result.', p_screening_verdict
      using errcode = 'P0001';
  end if;

  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then
    raise exception 'Batch not found.' using errcode = 'P0002';
  end if;
  if v_batch.status = 'recalled' then
    raise exception 'This batch has been recalled and cannot be dispensed.' using errcode = 'P0003';
  end if;
  if v_batch.quantity_remaining < p_quantity then
    raise exception 'Insufficient stock: % remaining, % requested.', v_batch.quantity_remaining, p_quantity
      using errcode = 'P0004';
  end if;

  update public.batches
    set quantity_remaining = quantity_remaining - p_quantity
    where id = p_batch_id;

  insert into public.dispense_records (
    prescription_id, patient_id, pharmacist_id, batch_id, drug_id, drug_name,
    quantity_dispensed, partial_dispense_reason, screening_verdict, screening_flags,
    screened_at, override_note
  ) values (
    p_prescription_id, p_patient_id, p_pharmacist_id, p_batch_id, p_drug_id, p_drug_name,
    p_quantity, p_partial_dispense_reason, p_screening_verdict, p_screening_flags,
    p_screened_at, p_override_note
  )
  returning * into v_record;

  -- The one legitimate path to this status, now atomic with the rest of
  -- the dispense. A prescription with multiple lines calls this once per
  -- line; re-setting the same value on later calls is a harmless no-op.
  update public.prescriptions set status = 'dispensed' where id = p_prescription_id;

  return v_record;
end;
$$;

drop policy if exists "prescriptions_update_own" on public.prescriptions;
create policy "prescriptions_update_own"
  on public.prescriptions for update to authenticated
  using (prescriber_id = auth.uid())
  with check (prescriber_id = auth.uid() and status <> 'dispensed');

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
  );
