-- Closes the real institution boundary on pharmacy inventory. Confirmed with
-- the user first (a bigger fix than 0019's override_logs precedent):
--
-- `batches` had NO institution concept anywhere — not even the indirect link
-- dispense_records/override_logs have through prescription_id. RLS was
-- `using (true)` for select AND update, so any authenticated pharmacist at
-- any institution could view, and directly modify (zero quantity, mark
-- recalled), any other institution's stock. `dispense_records`' select
-- policy was also fully open. And dispense_drug() never checked a batch's
-- institution against the dispensing pharmacist's, because there was nothing
-- to check — a pharmacist dispensing against their own institution's
-- prescription could pass any batchId and decrement another institution's
-- real stock, unnoticed.
--
-- Design: mirrors the two-tier patients/prescriptions model exactly
-- (0004 + 0012) rather than inventing a new shape — confirmed with the user
-- that independent pharmacists have their own private stock in this app's
-- model, same as an independent physician has their own private patients:
--   - owner_id (always set, from the creating pharmacist's own JWT — never
--     client-chosen): "my own stock," visible/editable regardless of
--     institution. Covers independent pharmacists.
--   - institution_id (set only for institutional pharmacists, from their own
--     JWT claim): "my institution's stock," visible to admin/pharmacist at
--     that institution, editable by pharmacist only (same division of labor
--     as prescriptions_update_institution_pharmacist — admin gets oversight,
--     not raw write power over stock).
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- batches: add the columns, backfill existing rows, replace the open policies.
-- ---------------------------------------------------------------------------

alter table public.batches add column if not exists institution_id uuid references public.institutions (id);
alter table public.batches add column if not exists owner_id uuid references auth.users (id);

create index if not exists batches_institution_id_idx on public.batches (institution_id);
create index if not exists batches_owner_id_idx on public.batches (owner_id);

-- Pre-existing rows predate any per-institution/per-owner concept on this
-- table (no pharmacist_id column ever existed to attribute them to a
-- specific person) — every real batch in this database today was seeded for
-- the one demo institution, so backfill to that institution specifically
-- rather than leaving them permanently orphaned from both policies below.
-- owner_id is left null for these (genuinely unknown who added them);
-- institution-staff visibility still covers them.
update public.batches
  set institution_id = (select id from public.institutions where name = 'Korle Bu Teaching Hospital' limit 1)
  where institution_id is null;

drop policy if exists "batches_select_authenticated" on public.batches;
drop policy if exists "batches_insert_authenticated" on public.batches;
drop policy if exists "batches_update_authenticated" on public.batches;

create policy "batches_select_own"
  on public.batches for select to authenticated
  using (owner_id = auth.uid());

create policy "batches_select_institution_staff"
  on public.batches for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('pharmacist', 'admin')
    and institution_id is not null
    and institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

create policy "batches_insert_own"
  on public.batches for insert to authenticated
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist'
    and owner_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

create policy "batches_update_own"
  on public.batches for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "batches_update_institution_pharmacist"
  on public.batches for update to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist'
    and institution_id is not null
    and institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  )
  with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacist'
    and institution_id is not null
    and institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
  );

-- No delete policy — unchanged from 0010 (batches are corrected via stock
-- adjustments or marked recalled, never deleted).

-- ---------------------------------------------------------------------------
-- dispense_records: replace the fully-open select policy with the same
-- three-tier visibility prescriptions/patients already have — own (the
-- dispensing pharmacist), institution-staff (admin/pharmacist, joined
-- through prescription_id same as override_logs in 0019), and via-own-patient
-- (a prescriber viewing their own patient's dispense history on the patient
-- detail page — app/(app)/patients/[id]/page.tsx, which every role that can
-- reach /patients relies on today).
-- ---------------------------------------------------------------------------

drop policy if exists "dispense_records_select_authenticated" on public.dispense_records;

create policy "dispense_records_select_own_pharmacist"
  on public.dispense_records for select to authenticated
  using (pharmacist_id = auth.uid());

create policy "dispense_records_select_institution_staff"
  on public.dispense_records for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'pharmacist')
    and (auth.jwt() -> 'app_metadata' ->> 'institution_id') is not null
    and exists (
      select 1 from public.prescriptions rx
      where rx.id = dispense_records.prescription_id
        and rx.institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    )
  );

create policy "dispense_records_select_via_own_patient"
  on public.dispense_records for select to authenticated
  using (
    exists (
      select 1 from public.patients p
      where p.id = dispense_records.patient_id
        and p.owner_id = auth.uid()
    )
  );

-- No insert/update/delete policy for `authenticated` — unchanged from 0010.
-- dispense_drug() below (security definer) is still the only writer.

-- ---------------------------------------------------------------------------
-- dispense_drug: add the institution/ownership check the original version
-- never had. Runs on the already row-locked batch (see the "for update"
-- select just above this check), so this is race-free — no separate
-- pre-check in the route could dispense against a batch out from under this
-- verification. Two branches, mirroring the exact sameInstitution/ownWalkIn
-- split app/api/pharmacy/dispense/route.ts already uses for the prescription
-- itself: an institutional caller's batch must match their own institution;
-- an independent caller's batch must be their own private stock (comparing
-- institution_id alone would otherwise treat every independent pharmacist's
-- null institution_id as "the same institution" as every other one).
-- ---------------------------------------------------------------------------

drop function if exists public.dispense_drug(
  uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, timestamptz, text
);

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
  p_override_note text,
  p_caller_institution_id uuid
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

  if p_caller_institution_id is not null then
    if v_batch.institution_id is distinct from p_caller_institution_id then
      raise exception 'This batch does not belong to your institution.' using errcode = 'P0005';
    end if;
  else
    if v_batch.owner_id is distinct from p_pharmacist_id then
      raise exception 'This batch does not belong to your own stock.' using errcode = 'P0005';
    end if;
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

  return v_record;
end;
$$;

revoke all on function public.dispense_drug(
  uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, timestamptz, text, uuid
) from public;
revoke all on function public.dispense_drug(
  uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, timestamptz, text, uuid
) from authenticated;
grant execute on function public.dispense_drug(
  uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, timestamptz, text, uuid
) to service_role;
