-- Phase D: real, per-institution API authentication for the Facility Admin
-- product. Before this migration, authorizeApiKey() checked incoming keys
-- against only a global MEDIGUARD_API_KEYS env var, with a fallback regex
-- that accepted almost any well-formed mg_live_/mg_sandbox_-shaped string —
-- explicitly documented as demo-grade, never production auth. This
-- migration adds the real schema that rewrite depends on. Safe to re-run:
-- every statement is idempotent.

create table if not exists public.institutions (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  enforcement_level text not null default 'advisory' check (enforcement_level in ('advisory', 'enforced')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

alter table public.institutions enable row level security;

drop policy if exists "institutions_select_own" on public.institutions;
create policy "institutions_select_own"
  on public.institutions for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid = id);

-- No client insert/update/delete policy at all — row creation and status
-- (suspend/reinstate) are service-role-only. enforcement_level changes go
-- through the narrow RPC below, not a raw UPDATE, so a client can never
-- touch any other column on its own institution row.

-- ---------------------------------------------------------------------------
-- institution_api_keys: the actual secret material. key_hash is a sha256
-- hex digest of the raw key — the raw key itself is NEVER stored anywhere,
-- only returned once in the mint response. Deliberately ZERO RLS policies
-- on this base table (RLS enabled, no permissive policy = deny-all to every
-- client, always) — access goes entirely through institution_api_keys_public
-- below (which never selects key_hash) and the privileged mint/revoke
-- routes (service-role, bypasses RLS by design).
-- ---------------------------------------------------------------------------

create table if not exists public.institution_api_keys (
  id uuid primary key default extensions.gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  mode text not null check (mode in ('live', 'sandbox')),
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists institution_api_keys_institution_id_idx on public.institution_api_keys (institution_id);
create unique index if not exists institution_api_keys_key_hash_idx on public.institution_api_keys (key_hash);

alter table public.institution_api_keys enable row level security;
-- No policies — see comment above.

-- Explicit filter embedded in the view body (not relying on base-table RLS,
-- which has none) — this is the only path a client has to read anything
-- about its own keys, and it can never select key_hash even in principle.
create or replace view public.institution_api_keys_public as
  select id, institution_id, mode, key_prefix, last_used_at, revoked_at, created_at
  from public.institution_api_keys
  where institution_id = (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid;

grant select on public.institution_api_keys_public to authenticated;

-- update_my_institution_enforcement_level(): the only client-writable path
-- onto institutions, deliberately narrow (one column) and deliberately
-- scoped internally via the caller's own JWT claim, not a parameter — a
-- caller-supplied institution id here would let one institution's admin
-- change another's enforcement level.
create or replace function public.update_my_institution_enforcement_level(p_level text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_institution_id uuid := (auth.jwt() -> 'app_metadata' ->> 'institution_id')::uuid;
begin
  if v_institution_id is null then
    raise exception 'No institution associated with this account.';
  end if;
  if p_level not in ('advisory', 'enforced') then
    raise exception 'Invalid enforcement level.';
  end if;
  update public.institutions set enforcement_level = p_level where id = v_institution_id;
end;
$$;

revoke all on function public.update_my_institution_enforcement_level(text) from public;
grant execute on function public.update_my_institution_enforcement_level(text) to authenticated;

-- ---------------------------------------------------------------------------
-- One-time, targeted demo seed (same discipline as the owner_id backfill in
-- 0004 and the subscription seed in 0006) — without this, the existing demo
-- Facility Admin account has no institution at all and /admin/integration
-- breaks for it. Guarded on the account not already having an
-- institution_id claim, so this is safe to re-run. No-ops if the account
-- doesn't exist in this project.
--
-- NOTE: a browser session already logged in as this account has a JWT
-- minted before this claim existed — it needs to log out and back in (or
-- wait for a natural token refresh) to see the new institution_id claim.
-- ---------------------------------------------------------------------------

do $$
declare
  v_admin_id uuid;
  v_existing_institution_id text;
  v_institution_id uuid;
begin
  select id, raw_app_meta_data ->> 'institution_id'
    into v_admin_id, v_existing_institution_id
  from auth.users where email = 'efua.boateng@demo.mediguard.gh';

  if v_admin_id is not null and v_existing_institution_id is null then
    insert into public.institutions (name, status, enforcement_level, created_by)
    values ('Korle Bu Teaching Hospital', 'active', 'advisory', v_admin_id)
    returning id into v_institution_id;

    update auth.users
    set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('institution_id', v_institution_id)
    where id = v_admin_id;
  end if;
end $$;
