-- Phase F: hard dispense gate — a drug cannot be dispensed without a fresh,
-- server-side screening pass, and any caution/blocked result requires a
-- genuine, non-trivial override note.
--
-- Scope: moves `batches` and `dispense_records` off per-browser Dexie onto
-- shared Postgres (the "Phase 3/4" pharmacy-inventory migration flagged as
-- deferred in 0002's own header comment, now executed because this specific
-- gate cannot be built honestly on IndexedDB — there is no server boundary
-- to enforce anything against). stockAdjustments and pharmacySettings stay
-- on Dexie: they're not part of the dispense-safety path this task is about.
--
-- The critical design decision here is NOT the RLS policy on dispense_records
-- — it's that dispense_drug() is granted to `service_role` only, never to
-- `authenticated`. A signed-in pharmacist's browser session can never invoke
-- it directly, no matter what verdict/override values they might try to pass.
-- The only caller is app/api/pharmacy/dispense/route.ts, running server-side
-- with the service-role key, which re-runs the real screenDrugLine engine
-- against fresh patient data before ever calling this function — so the
-- screening result reaching the database is never client-supplied, and
-- dispense_records has no INSERT policy for `authenticated` at all, so it is
-- literally unreachable except through that one server code path.
--
-- Apply via the Supabase Dashboard SQL Editor (or `supabase db push`). Safe
-- to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- batches: shared clinical/operational record, same broad-authenticated
-- pattern as patients/prescriptions (no per-user siloing anywhere in this
-- app). quantity_remaining is still writable directly by this policy (a
-- pharmacist can correct stock via applyStockAdjustment) — the dispense path
-- specifically goes through dispense_drug() below for the atomic, gated
-- decrement, but this table's own RLS doesn't need to forbid direct updates
-- to stay consistent with how every other table in this project is scoped.
-- ---------------------------------------------------------------------------

create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  drug_id text not null,
  batch_number text not null,
  supplier text not null,
  received_date date not null,
  expiry_date date not null,
  quantity_remaining integer not null check (quantity_remaining >= 0),
  status text not null default 'active' check (status in ('active', 'recalled')),
  created_at timestamptz not null default now()
);

create index if not exists batches_drug_id_idx on public.batches (drug_id);
create index if not exists batches_expiry_date_idx on public.batches (expiry_date);

alter table public.batches enable row level security;

drop policy if exists "batches_select_authenticated" on public.batches;
create policy "batches_select_authenticated"
  on public.batches for select to authenticated using (true);

drop policy if exists "batches_insert_authenticated" on public.batches;
create policy "batches_insert_authenticated"
  on public.batches for insert to authenticated with check (true);

drop policy if exists "batches_update_authenticated" on public.batches;
create policy "batches_update_authenticated"
  on public.batches for update to authenticated using (true) with check (true);

-- No delete policy — batches are corrected via stock adjustments or marked
-- recalled, never deleted.

-- ---------------------------------------------------------------------------
-- dispense_records: the hard-gated write. Deliberately NO insert/update/
-- delete policy for `authenticated` — the only writer is dispense_drug(),
-- called exclusively from the server route holding the service-role key.
-- SELECT is broad-authenticated (shared clinical/audit record, matches
-- override_logs/prescriptions), since Reports/Audit/patient-history pages
-- need to read these.
--
-- screening_verdict/screening_flags/screened_at capture the REAL screening
-- result that was checked at the moment of dispense (re-run fresh, not read
-- from a possibly-stale earlier pass — see the route handler). The check
-- constraint is a second, independent enforcement of the override-note rule
-- at the schema level: even if the route handler had a bug, Postgres itself
-- refuses to persist a flagged dispense without a genuine override note.
-- ---------------------------------------------------------------------------

create table if not exists public.dispense_records (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id),
  patient_id uuid not null references public.patients (id),
  pharmacist_id uuid not null references auth.users (id),
  batch_id uuid not null references public.batches (id),
  drug_id text not null,
  drug_name text not null,
  quantity_dispensed integer not null check (quantity_dispensed > 0),
  partial_dispense_reason text,
  screening_verdict text not null check (screening_verdict in ('safe', 'caution', 'blocked')),
  screening_flags jsonb not null,
  screened_at timestamptz not null,
  override_note text,
  dispensed_at timestamptz not null default now(),
  constraint override_note_required_if_flagged check (
    screening_verdict = 'safe'
    or (
      override_note is not null
      and length(trim(override_note)) >= 10
      and lower(trim(override_note)) not in (
        'ok', 'okay', 'na', 'n/a', 'none', 'no', 'yes', '-', '--', 'fine', 'proceed', 'approved', 'confirmed'
      )
    )
  )
);

create index if not exists dispense_records_prescription_id_idx on public.dispense_records (prescription_id);
create index if not exists dispense_records_patient_id_idx on public.dispense_records (patient_id);
create index if not exists dispense_records_pharmacist_id_idx on public.dispense_records (pharmacist_id);
create index if not exists dispense_records_batch_id_idx on public.dispense_records (batch_id);

alter table public.dispense_records enable row level security;

drop policy if exists "dispense_records_select_authenticated" on public.dispense_records;
create policy "dispense_records_select_authenticated"
  on public.dispense_records for select to authenticated using (true);

-- No insert/update/delete policy for `authenticated` — see header comment.
-- dispense_drug() below (security definer) is the only writer.

-- ---------------------------------------------------------------------------
-- dispense_drug: atomic "check stock, decrement, write the record" RPC.
-- Re-validates the override-note rule in code (for a clean error message)
-- in addition to the table's own CHECK constraint (the unconditional
-- backstop). Locks the batch row (for update) to make concurrent dispenses
-- against the same batch safe.
--
-- Granted to service_role ONLY — see header comment for why this is the
-- actual security boundary, not the RLS policies above.
-- ---------------------------------------------------------------------------

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

  return v_record;
end;
$$;

revoke all on function public.dispense_drug(
  uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, timestamptz, text
) from public;
revoke all on function public.dispense_drug(
  uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, timestamptz, text
) from authenticated;
grant execute on function public.dispense_drug(
  uuid, uuid, uuid, uuid, text, text, integer, text, text, jsonb, timestamptz, text
) to service_role;
