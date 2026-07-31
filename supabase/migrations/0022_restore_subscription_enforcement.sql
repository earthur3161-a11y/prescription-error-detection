-- Restores subscription enforcement that 0012_institution_boundary.sql
-- silently dropped, and fixes the underlying "status can go stale past
-- period_end" bug that made the gap hard to notice from the client side.
--
-- BUG A (the urgent one): 0006_subscriptions.sql's patients_insert_own /
-- prescriptions_insert_own required status = 'active' AND period_end > now()
-- in addition to ownership. When 0012 replaced both policies to add
-- institution scoping, it dropped the subscription/expiry condition
-- entirely -- confirmed live: an expired (or never-subscribed) account
-- could insert patients/prescriptions freely, with zero DB-layer
-- enforcement, for every account regardless of role or institution.
--
-- Two account populations, by design (0012's own header, "Decision 2,
-- confirmed with the user") -- confirmed independently here by re-reading
-- app/api/admin/access-requests/[id]/approve/route.ts: it never creates a
-- subscriptions row for institutional staff at all (only
-- app/api/auth/signup.ts, the independent /physician/signup and
-- /pharmacy/signup path, does that). So the restored check below is NOT a
-- flat AND of both conditions -- an institution_id claim present means
-- access is already governed by that institution's own relationship, and
-- MUST short-circuit the subscription check entirely, or every
-- institutional physician/pharmacist/admin (who structurally never has a
-- subscriptions row) would be locked out of ever creating a patient or
-- prescription. Only an independent practitioner (no institution_id claim)
-- needs an active, unexpired subscription of their own.
--
-- BUG B: get_my_subscription_status() returned the raw stored `status`
-- column verbatim, never checking period_end against now() -- so an
-- account whose period lapsed without anything ever writing a new status
-- (nothing in this codebase does; there's no cancellation/expiry job)
-- read as "active" forever to every client-side caller (SubscriptionGuard,
-- /billing's "Active until <date>" display), even though DB-layer
-- enforcement (once restored below) would already reject writes. Fixed by
-- adding a genuinely-derived `is_active` column computed the same way the
-- RLS check above computes validity -- one definition of "really active,"
-- not two that can drift. Return type changed, so the function must be
-- dropped and recreated, not just replaced.
--
-- Apply via the Supabase Dashboard SQL Editor. Safe to re-run.

drop function if exists public.get_my_subscription_status();

create function public.get_my_subscription_status()
returns table (product text, status text, period_end timestamptz, days_remaining int, is_active boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.product,
    s.status,
    s.period_end,
    greatest(0, ceil(extract(epoch from (s.period_end - now())) / 86400))::int as days_remaining,
    (s.status = 'active' and s.period_end > now()) as is_active
  from public.subscriptions s
  where s.owner_id = auth.uid();
$$;

revoke all on function public.get_my_subscription_status() from public;
grant execute on function public.get_my_subscription_status() to authenticated;

-- ---------------------------------------------------------------------------
-- patients_insert_own: institution scoping (0012) AND subscription
-- enforcement (0006), both required together for an independent
-- practitioner; institutional staff skip the subscription clause entirely.
-- ---------------------------------------------------------------------------

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own"
  on public.patients for insert to authenticated
  with check (
    owner_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    and (
      (auth.jwt() -> 'app_metadata' ->> 'institution_id') is not null
      or exists (
        select 1 from public.subscriptions s
        where s.owner_id = auth.uid() and s.status = 'active' and s.period_end > now()
      )
    )
  );

drop policy if exists "prescriptions_insert_own" on public.prescriptions;
create policy "prescriptions_insert_own"
  on public.prescriptions for insert to authenticated
  with check (
    prescriber_id = auth.uid()
    and institution_id is not distinct from (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid
    and (
      (auth.jwt() -> 'app_metadata' ->> 'institution_id') is not null
      or exists (
        select 1 from public.subscriptions s
        where s.owner_id = auth.uid() and s.status = 'active' and s.period_end > now()
      )
    )
  );
