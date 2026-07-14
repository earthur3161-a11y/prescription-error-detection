-- Phase C: Physician/Pharmacy Portal subscriptions via Paystack. A simpler
-- "active until period_end, renewed by a one-off charge" model rather than
-- real recurring Paystack Subscriptions — Paystack's recurring-charge
-- mechanism (stored authorization reuse) is mature for cards but not
-- reliable for Ghanaian Mobile Money, and building it now would mean also
-- adding card payments as a separate track. Real recurring billing is
-- explicit future work. Modeled directly on 0003_self_check_quota.sql's
-- quota/payment pattern. Safe to re-run: every statement is idempotent.

create table if not exists public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  product text not null check (product in ('physician_portal', 'pharmacy_portal')),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'past_due', 'canceled')),
  period_end timestamptz,
  provider text not null default 'paystack',
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, product)
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using (owner_id = auth.uid());

-- No client insert/update/delete policy — service-role-write-only, exactly
-- like check_payments in 0003.

create table if not exists public.subscription_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  product text not null check (product in ('physician_portal', 'pharmacy_portal')),
  amount_pesewas int not null,
  period_days int not null default 30,
  provider text not null default 'paystack',
  provider_reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists subscription_payments_owner_id_idx on public.subscription_payments (owner_id);

alter table public.subscription_payments enable row level security;

drop policy if exists "subscription_payments_select_own" on public.subscription_payments;
create policy "subscription_payments_select_own"
  on public.subscription_payments for select to authenticated
  using (owner_id = auth.uid());

-- get_my_subscription_status(): deliberately NO parameters, scoped
-- internally via auth.uid() only — a caller-supplied id on a SECURITY
-- DEFINER function is exactly the shape of bug that would let one tenant
-- probe another's billing state.
create or replace function public.get_my_subscription_status()
returns table (product text, status text, period_end timestamptz, days_remaining int)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.product,
    s.status,
    s.period_end,
    greatest(0, ceil(extract(epoch from (s.period_end - now())) / 86400))::int as days_remaining
  from public.subscriptions s
  where s.owner_id = auth.uid();
$$;

revoke all on function public.get_my_subscription_status() from public;
grant execute on function public.get_my_subscription_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Defense in depth at the DB layer, not just a UI guard: patients and
-- prescriptions can only be created (INSERT) by an owner with an active,
-- unexpired subscription. SELECT stays ungated (per-owner via the existing
-- 0004 policies) so a lapsed subscriber can still view their historical
-- data rather than a jarring full lockout.
-- ---------------------------------------------------------------------------

drop policy if exists "patients_insert_own" on public.patients;
create policy "patients_insert_own"
  on public.patients for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.subscriptions s
      where s.owner_id = auth.uid() and s.status = 'active' and s.period_end > now()
    )
  );

drop policy if exists "prescriptions_insert_own" on public.prescriptions;
create policy "prescriptions_insert_own"
  on public.prescriptions for insert to authenticated
  with check (
    prescriber_id = auth.uid()
    and exists (
      select 1 from public.subscriptions s
      where s.owner_id = auth.uid() and s.status = 'active' and s.period_end > now()
    )
  );

-- ---------------------------------------------------------------------------
-- Physician and Pharmacy accounts are now self-serve (POST /api/auth/signup)
-- with a subscription gate, not Super-Admin-approved — access_requests
-- becomes exclusively for Facility Admin onboarding. NOT VALID so this only
-- blocks new inserts going forward; it does not touch/reject any existing
-- pending/approved/rejected rows, whatever role they were requested under.
-- ---------------------------------------------------------------------------

alter table public.access_requests drop constraint if exists access_requests_requested_role_check;
alter table public.access_requests add constraint access_requests_requested_role_check
  check (requested_role = 'admin') not valid;

-- ---------------------------------------------------------------------------
-- One-time, targeted seed for the live demo accounts (matched by known
-- email, same discipline as the owner_id backfill in 0004) — without this,
-- the demo physician/pharmacist would be immediately locked out of creating
-- new patients/prescriptions the moment this migration lands, since neither
-- has a subscription row at all. A 10-year period_end is a demo
-- convenience, not a real billing term. No-ops for any account that
-- doesn't exist in this project.
-- ---------------------------------------------------------------------------

insert into public.subscriptions (owner_id, product, status, period_end, provider_reference)
select id, 'physician_portal', 'active', now() + interval '10 years', 'demo_seed'
from auth.users where email = 'ama.owusu@demo.mediguard.gh'
on conflict (owner_id, product) do update set status = 'active', period_end = excluded.period_end;

insert into public.subscriptions (owner_id, product, status, period_end, provider_reference)
select id, 'pharmacy_portal', 'active', now() + interval '10 years', 'demo_seed'
from auth.users where email = 'kwame.mensah@demo.mediguard.gh'
on conflict (owner_id, product) do update set status = 'active', period_end = excluded.period_end;
