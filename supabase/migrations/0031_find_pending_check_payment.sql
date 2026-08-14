-- Lets UnlockCheckStep.tsx resume tracking a still-pending Mobile Money
-- payment after a page reload, mirroring findPendingSubscriptionPayment's
-- purpose for the professional-subscription flow. That flow can lean on a
-- plain RLS-scoped select (owner_id = auth.uid()); Patient Self-Check is
-- anonymous — no Supabase session to scope by — so this follows the same
-- SECURITY DEFINER, phone-as-credential pattern get_check_quota and
-- get_payment_status already use (0003_self_check_quota.sql), rather than
-- exposing check_payments to anon SELECT directly.

create or replace function public.find_pending_check_payment(p_phone text)
returns table (provider_reference text)
language sql
security definer
set search_path = public
as $$
  select cp.provider_reference
  from public.check_payments cp
  where cp.phone = public.normalize_gh_phone(p_phone)
    and cp.status = 'pending'
  order by cp.created_at desc
  limit 1;
$$;

revoke all on function public.find_pending_check_payment(text) from public;
grant execute on function public.find_pending_check_payment(text) to anon, authenticated;
