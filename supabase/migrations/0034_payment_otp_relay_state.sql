-- Backing state for the Paystack Mobile Money "send_otp" relay
-- (lib/payments/paystackCharge.ts, app/api/*/submit-otp): that whole feature
-- was found, via adversarial review, to have two real gaps once it actually
-- has to survive a reload or a hostile caller:
--
-- 1. awaiting_otp: without this persisted, a client that reloads mid-OTP
--    (received the code, hasn't entered it yet) has no way to know its
--    resumed pending payment is specifically waiting on a code — it just
--    shows a generic spinner forever with no input to complete the charge.
--    Both find_pending_check_payment (below) and the plain owner-scoped
--    select in findPendingSubscriptionPayment now return it.
--
-- 2. otp_submit_attempts: the submit-otp routes had no attempt limit at
--    all — an unauthenticated caller (self-check) or anyone holding a
--    stolen bearer token (subscriptions) could hammer /charge/submit_otp
--    indefinitely. Capped at OTP_MAX_SUBMIT_ATTEMPTS (5, matching this
--    project's existing SMS-OTP convention — see OTP_MAX_VERIFY_ATTEMPTS in
--    app/api/otp/verify/route.ts) in the route code; this column is where
--    that count lives.
--
-- No RLS policy touched here — check_payments and subscription_payments
-- both remain fully service-role-write-only exactly as 0003/0006 set them
-- up; this migration only adds columns.

alter table public.subscription_payments
  add column if not exists awaiting_otp boolean not null default false,
  add column if not exists otp_submit_attempts int not null default 0;

alter table public.check_payments
  add column if not exists awaiting_otp boolean not null default false,
  add column if not exists otp_submit_attempts int not null default 0;

-- find_pending_check_payment's return shape is changing (adding a column),
-- which create-or-replace can't do for a `returns table` function —
-- requires drop + recreate. Every condition 0031 enforced (phone match,
-- status = 'pending', anon+authenticated execute) is preserved verbatim
-- below; the only change is the added awaiting_otp column in the result.
drop function if exists public.find_pending_check_payment(text);

create function public.find_pending_check_payment(p_phone text)
returns table (provider_reference text, awaiting_otp boolean)
language sql
security definer
set search_path = public
as $$
  select cp.provider_reference, cp.awaiting_otp
  from public.check_payments cp
  where cp.phone = public.normalize_gh_phone(p_phone)
    and cp.status = 'pending'
  order by cp.created_at desc
  limit 1;
$$;

revoke all on function public.find_pending_check_payment(text) from public;
grant execute on function public.find_pending_check_payment(text) to anon, authenticated;
