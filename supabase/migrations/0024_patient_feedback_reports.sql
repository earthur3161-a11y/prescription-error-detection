-- Moves the Patient Self-Check "report an issue" flow off per-browser Dexie
-- onto shared Postgres. Before this, a patient's report was written to their
-- own browser's IndexedDB and the admin audit-log page read from its own,
-- completely separate IndexedDB — the two could never connect, so a report
-- never actually reached anyone.
--
-- Same narrow-RPC security posture as patient_checks/self_check_accounts
-- (0003_self_check_quota.sql): no anon INSERT policy at all — the only path
-- in is create_patient_feedback_report() below, security definer. No anon
-- SELECT either, so a submitter can never read back any report, including
-- their own. Broad-authenticated SELECT matches the admin audit-log page's
-- existing broad-read philosophy; no institution scoping, since a self-check
-- carries no institution concept until pulled into a real prescription (same
-- reasoning already applied to patient_checks itself, see AGENTS.md).
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

create table if not exists public.patient_feedback_reports (
  id uuid primary key default gen_random_uuid(),
  patient_check_id uuid references public.patient_checks (id),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists patient_feedback_reports_created_at_idx
  on public.patient_feedback_reports (created_at);

alter table public.patient_feedback_reports enable row level security;

drop policy if exists "patient_feedback_reports_select_authenticated" on public.patient_feedback_reports;
create policy "patient_feedback_reports_select_authenticated"
  on public.patient_feedback_reports for select to authenticated using (true);

-- No insert/update/delete policy for `authenticated` or `anon` — see header
-- comment. create_patient_feedback_report() is the only writer.

create or replace function public.create_patient_feedback_report(
  p_patient_check_id uuid,
  p_message text
)
returns public.patient_feedback_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.patient_feedback_reports%rowtype;
begin
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'A message is required.' using errcode = 'P0001';
  end if;

  insert into public.patient_feedback_reports (patient_check_id, message)
  values (p_patient_check_id, trim(p_message))
  returning * into v_record;

  return v_record;
end;
$$;

revoke all on function public.create_patient_feedback_report(uuid, text) from public;
grant execute on function public.create_patient_feedback_report(uuid, text) to anon, authenticated;
