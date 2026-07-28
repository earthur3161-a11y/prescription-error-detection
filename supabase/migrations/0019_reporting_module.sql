-- Item 6: reporting module — daily/monthly aggregates, error trends, drug
-- usage, and prescriber performance, correctly scoped for both institutional
-- staff (by institution_id) and independent practitioners (by their own
-- user id). Also closes item 7 (/admin/analytics was unscoped since the RLS
-- tightening in 0008) as part of the same pass, and fixes a related
-- under-scoping bug on override_logs that was silently breaking
-- /admin/compliance and /admin/audit-log's institution-wide numbers.
--
-- Design: SECURITY DEFINER RPCs, same shape as the superadmin activity RPCs
-- (0009) — each function derives the caller's role/institution from their own
-- JWT claims and scopes internally, rather than trusting a client-supplied
-- institution_id/user_id parameter. Matches the ACTUAL existing institution-
-- visibility precedent confirmed in 0012: institution-wide visibility is an
-- admin/pharmacist privilege only — a prescriber at an institution still only
-- ever sees their own data, same as an independent practitioner. So the scope
-- rule every RPC below uses is:
--   role in ('admin','pharmacist') and institution_id is not null
--     -> institution-wide aggregate
--   otherwise (prescriber, or no institution_id at all)
--     -> own data only (prescriber_id = auth.uid())
--
-- Patient self-checks and pharmacistActions are deliberately excluded from
-- every RPC here (confirmed with the user): self-checks carry no institution
-- concept until pulled into a real prescription, and pharmacistActions still
-- lives entirely in per-browser Dexie/IndexedDB, unreachable from any
-- server-side query (see AGENTS.md "Known architectural limitations").
--
-- Every version of an edited prescription (0016/0017 versioning) is counted,
-- not just the current one — each version is a real screening event that
-- happened, and filtering to superseded_by is null would undercount real
-- safety activity. Matches the precedent already set for facilityMetrics/
-- auditEvents (deliberately NOT filtered to current-only, unlike the "live"
-- list views).
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- override_logs: additive institution-staff SELECT policy. The only existing
-- SELECT policy (0004) is "own" (user_id = auth.uid()), which silently limits
-- an admin/pharmacist to only the overrides THEY personally logged — not
-- their institution's — which is why override-rate numbers on
-- /admin/compliance and /admin/audit-log have been reading near-zero. Scoped
-- via the same indirection AGENTS.md already documents (override_logs has no
-- institution_id of its own; joins through prescriptions, which does).
-- OR'd alongside the existing "own" policy (Postgres RLS policies are OR'd
-- together, same mechanism used throughout this project) — no existing
-- visibility is narrowed, this only adds institution-wide visibility for
-- admin/pharmacist.
-- ---------------------------------------------------------------------------

drop policy if exists "override_logs_select_institution_staff" on public.override_logs;
create policy "override_logs_select_institution_staff"
  on public.override_logs for select to authenticated
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'pharmacist')
    and (auth.jwt() -> 'app_metadata' ->> 'institution_id') is not null
    and exists (
      select 1 from public.prescriptions rx
      where rx.id = override_logs.prescription_id
        and rx.institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- get_reporting_summary: total prescriptions/lines, verdict mix, override
-- count over a date range. EML compliance and per-drug labeling stay
-- client-side (the formulary is a static TS module, not a Postgres table —
-- same boundary the existing audit-log/analytics pages already respect).
-- ---------------------------------------------------------------------------

create or replace function public.get_reporting_summary(
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns table (
  total_prescriptions bigint,
  total_lines bigint,
  safe_lines bigint,
  caution_lines bigint,
  blocked_lines bigint,
  override_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_institution_id uuid := (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid;
  v_role text := (auth.jwt() -> 'app_metadata' ->> 'role');
  v_institution_scope boolean := v_institution_id is not null and v_role in ('admin', 'pharmacist');
begin
  return query
  with scoped_rx as (
    select rx.id, rx.verdicts
    from public.prescriptions rx
    where rx.created_at::date between p_from and p_to
      and (
        (v_institution_scope and rx.institution_id = v_institution_id)
        or (not v_institution_scope and rx.prescriber_id = auth.uid())
      )
  ),
  line_verdicts as (
    select (v ->> 'verdict') as verdict
    from scoped_rx rx, jsonb_array_elements(rx.verdicts) as v
  )
  select
    (select count(*) from scoped_rx),
    (select count(*) from line_verdicts),
    (select count(*) from line_verdicts where verdict = 'safe'),
    (select count(*) from line_verdicts where verdict = 'caution'),
    (select count(*) from line_verdicts where verdict = 'blocked'),
    (select count(*) from public.override_logs ol join scoped_rx rx on rx.id = ol.prescription_id
     where ol."timestamp"::date between p_from and p_to);
end;
$$;

revoke all on function public.get_reporting_summary(date, date) from public;
grant execute on function public.get_reporting_summary(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- get_reporting_daily_trend: one row per calendar day with a screening in
-- range, verdict mix per day. This is the "error trend" view.
-- ---------------------------------------------------------------------------

create or replace function public.get_reporting_daily_trend(
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns table (
  day date,
  safe_count bigint,
  caution_count bigint,
  blocked_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_institution_id uuid := (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid;
  v_role text := (auth.jwt() -> 'app_metadata' ->> 'role');
  v_institution_scope boolean := v_institution_id is not null and v_role in ('admin', 'pharmacist');
begin
  return query
  with scoped_rx as (
    select rx.created_at::date as day, rx.verdicts
    from public.prescriptions rx
    where rx.created_at::date between p_from and p_to
      and (
        (v_institution_scope and rx.institution_id = v_institution_id)
        or (not v_institution_scope and rx.prescriber_id = auth.uid())
      )
  ),
  line_verdicts as (
    select rx.day, (v ->> 'verdict') as verdict
    from scoped_rx rx, jsonb_array_elements(rx.verdicts) as v
  )
  select
    lv.day,
    count(*) filter (where lv.verdict = 'safe'),
    count(*) filter (where lv.verdict = 'caution'),
    count(*) filter (where lv.verdict = 'blocked')
  from line_verdicts lv
  group by lv.day
  order by lv.day;
end;
$$;

revoke all on function public.get_reporting_daily_trend(date, date) from public;
grant execute on function public.get_reporting_daily_trend(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- get_reporting_drug_usage: per-drug prescribing volume and flagged-line
-- count. Returns raw drug_id + counts; generic_name/EML-status labeling
-- happens client-side against the formulary, same boundary as summary above.
-- ---------------------------------------------------------------------------

create or replace function public.get_reporting_drug_usage(
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns table (
  drug_id text,
  times_prescribed bigint,
  flagged_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_institution_id uuid := (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid;
  v_role text := (auth.jwt() -> 'app_metadata' ->> 'role');
  v_institution_scope boolean := v_institution_id is not null and v_role in ('admin', 'pharmacist');
begin
  return query
  with scoped_rx as (
    select rx.verdicts
    from public.prescriptions rx
    where rx.created_at::date between p_from and p_to
      and (
        (v_institution_scope and rx.institution_id = v_institution_id)
        or (not v_institution_scope and rx.prescriber_id = auth.uid())
      )
  ),
  line_verdicts as (
    select (v ->> 'drugId') as drug_id, (v ->> 'verdict') as verdict
    from scoped_rx rx, jsonb_array_elements(rx.verdicts) as v
  )
  select
    lv.drug_id,
    count(*),
    count(*) filter (where lv.verdict <> 'safe')
  from line_verdicts lv
  group by lv.drug_id
  order by count(*) desc;
end;
$$;

revoke all on function public.get_reporting_drug_usage(date, date) from public;
grant execute on function public.get_reporting_drug_usage(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- get_reporting_flag_types: per-flag-type counts across every screened line
-- in range. Labeling (FLAG_TYPE_LABEL) happens client-side.
-- ---------------------------------------------------------------------------

create or replace function public.get_reporting_flag_types(
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns table (
  flag_type text,
  count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_institution_id uuid := (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid;
  v_role text := (auth.jwt() -> 'app_metadata' ->> 'role');
  v_institution_scope boolean := v_institution_id is not null and v_role in ('admin', 'pharmacist');
begin
  return query
  with scoped_rx as (
    select rx.verdicts
    from public.prescriptions rx
    where rx.created_at::date between p_from and p_to
      and (
        (v_institution_scope and rx.institution_id = v_institution_id)
        or (not v_institution_scope and rx.prescriber_id = auth.uid())
      )
  ),
  flags as (
    select (flag ->> 'type') as flag_type
    from scoped_rx rx,
      jsonb_array_elements(rx.verdicts) as v,
      jsonb_array_elements(v -> 'flags') as flag
  )
  select f.flag_type, count(*)
  from flags f
  group by f.flag_type
  order by count(*) desc;
end;
$$;

revoke all on function public.get_reporting_flag_types(date, date) from public;
grant execute on function public.get_reporting_flag_types(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- get_reporting_prescriber_performance: per-prescriber flag/override counts,
-- institution-wide comparison. Admin/pharmacist + institution only — a
-- prescriber (institutional or independent) has no equivalent, by design
-- (see the "Verify" note in the migration header: nothing to compare against
-- when you only ever see your own data anyway).
-- ---------------------------------------------------------------------------

create or replace function public.get_reporting_prescriber_performance(
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns table (
  prescriber_id uuid,
  prescriber_name text,
  total_lines bigint,
  flagged_lines bigint,
  override_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_institution_id uuid := (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid;
  v_role text := (auth.jwt() -> 'app_metadata' ->> 'role');
begin
  if v_institution_id is null or v_role not in ('admin', 'pharmacist') then
    raise exception 'Prescriber performance is available to institutional admin/pharmacist staff only.';
  end if;

  return query
  with scoped_rx as (
    select rx.id, rx.prescriber_id, rx.verdicts
    from public.prescriptions rx
    where rx.institution_id = v_institution_id
      and rx.created_at::date between p_from and p_to
  ),
  line_verdicts as (
    select rx.prescriber_id, (v ->> 'verdict') as verdict
    from scoped_rx rx, jsonb_array_elements(rx.verdicts) as v
  ),
  per_prescriber_lines as (
    select
      lv.prescriber_id,
      count(*) as total_lines,
      count(*) filter (where lv.verdict <> 'safe') as flagged_lines
    from line_verdicts lv
    group by lv.prescriber_id
  ),
  per_prescriber_overrides as (
    select rx.prescriber_id, count(*) as override_count
    from public.override_logs ol
    join scoped_rx rx on rx.id = ol.prescription_id
    where ol."timestamp"::date between p_from and p_to
    group by rx.prescriber_id
  )
  select
    ppl.prescriber_id,
    coalesce(pr.name, 'Unknown'),
    ppl.total_lines,
    ppl.flagged_lines,
    coalesce(ppo.override_count, 0)
  from per_prescriber_lines ppl
  left join per_prescriber_overrides ppo on ppo.prescriber_id = ppl.prescriber_id
  left join public.profiles pr on pr.id = ppl.prescriber_id
  order by ppl.total_lines desc;
end;
$$;

revoke all on function public.get_reporting_prescriber_performance(date, date) from public;
grant execute on function public.get_reporting_prescriber_performance(date, date) to authenticated;
