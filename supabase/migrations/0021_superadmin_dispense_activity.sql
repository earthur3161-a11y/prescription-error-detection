-- Closes the "small addition when needed" half of the last remaining
-- AGENTS.md gap: dispense_records moved to real Postgres in 0010, but the
-- Super Admin activity feed was never extended to read from it. Mirrors
-- get_superadmin_override_activity() (0009) exactly — administrative
-- metadata only (that a dispense happened, to whom, by whom, when, how
-- much), never the clinical content (drug identity, screening
-- verdict/flags, override note). Excluding drug_id/drug_name specifically
-- follows the same reasoning override_activity's own header comment already
-- documents: "Patient X received drug Y" is itself clinical information,
-- not just the verdict/severity attached to it.
--
-- Does NOT close the other half (stock adjustments / pharmacist-side
-- inventory actions) — those still live entirely in per-browser
-- Dexie/IndexedDB with no server-side table to query at all, unchanged from
-- before this migration.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

create or replace function public.get_superadmin_dispense_activity()
returns table (
  id uuid,
  dispensed_at timestamptz,
  prescription_id uuid,
  patient_id uuid,
  patient_name text,
  pharmacist_id uuid,
  pharmacist_name text,
  quantity_dispensed integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if (auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'superadmin' then
    raise exception 'Superadmin role required.';
  end if;

  return query
    select
      dr.id, dr.dispensed_at, dr.prescription_id,
      dr.patient_id, coalesce(pt.name, 'Unknown'),
      dr.pharmacist_id, coalesce(pr.name, 'Unknown'),
      dr.quantity_dispensed
    from public.dispense_records dr
    left join public.patients pt on pt.id = dr.patient_id
    left join public.profiles pr on pr.id = dr.pharmacist_id
    order by dr.dispensed_at desc;
end;
$$;

revoke all on function public.get_superadmin_dispense_activity() from public;
grant execute on function public.get_superadmin_dispense_activity() to authenticated;
