# Paystack Mobile Money Payment Integration

This document explains the real-world Mobile Money payment integration with Paystack for Ghana.

## Overview

Both paid flows (subscriptions and Patient Self-Check) charge Mobile Money through
`lib/payments/paystackCharge.ts`, a single shared helper. A Ghana Mobile Money charge's response
carries a `data.status` that says what happens next — the integration branches on it explicitly
rather than assuming every successful charge means "prompt sent, just wait":

- `"send_otp"` — Paystack sent the customer an OTP (via SMS/prompt). **The app must collect that
  code and relay it back to Paystack via `POST /charge/submit_otp`, or the charge never
  completes.** This is the step that was missing entirely before — a charge in this state used to
  get stuck forever, since nothing ever prompted for or submitted the code.
- `"pay_offline"` — a real native approve-with-PIN prompt was already sent to the customer's phone.
  No further action needed; just wait for the webhook/verify poll.
- `"success"` — already done instantly.
- Anything else, or the `/charge` call failing outright, falls back to `/transaction/initialize`
  (authorization URL), same as before.

## How It Works

### Payment Flow

1. **User Initiates Payment**
   - User enters phone number and selects Mobile Money provider (MTN/Vodafone/AirtelTigo)
   - Client sends request to `/api/subscriptions/initiate` or `/api/payments/initiate`

2. **Server Charges via Paystack** (`initiatePaystackMobileMoneyCharge`)
   - Calls `/charge` with the `mobile_money` object
   - Branches on `data.status` as described above
   - Falls back to `/transaction/initialize` only if the charge call itself fails

3. **Three Possible Outcomes**

   **Option A: OTP relay (`awaitingOtp: true`, `data.status: "send_otp"`)**
   - Client shows an input for the code the customer received and submits it via
     `/api/subscriptions/submit-otp` or `/api/payments/submit-otp`
   - Those routes relay it to Paystack's `POST /charge/submit_otp` (`submitPaystackOtp`)
   - Client then polls `/verify` as usual

   **Option B: Native prompt (`awaitingOtp: false`, `data.status: "pay_offline"`)**
   - Paystack already sent a real prompt to the customer's phone
   - Customer approves on their phone
   - Webhook notifies server of payment completion
   - Client polls `/api/subscriptions/verify` (or `/api/payments/verify`) for status

   **Option C: Authorization URL (charge call failed, `/transaction/initialize` fallback)**
   - Server receives an authorization URL from Paystack
   - Client redirects user to this URL
   - Paystack handles the full payment flow in a web view
   - After completion, Paystack redirects back to app
   - Webhook still confirms payment server-side

## API Changes

### `/api/subscriptions/initiate` Response

```json
{
  "reference": "ref_1234567890",
  "authorizationUrl": "https://checkout.paystack.com/...", // Optional
  "awaitingOtp": false,
  "displayMessage": "Approve the payment request sent to your phone."
}
```

### `/api/payments/initiate` Response

Same structure as subscriptions initiate.

### `/api/subscriptions/submit-otp` and `/api/payments/submit-otp`

New routes. Request: `{ "reference": "ref_1234567890", "otp": "123456" }`. Response:
`{ "ok": true, "message": "..." }`. Neither route touches the database itself — the existing
`/verify` poll (or the webhook) observes the outcome once Paystack processes the relayed code.

## Implementation Details

### Retry Logic

- Both initiate endpoints retry failed requests up to 2 times with exponential backoff
- Transient errors (network, timeouts) trigger retry
- Permanent errors (invalid config) fail immediately

### Fallback Strategy

1. Try `/charge` endpoint → branch on `data.status` (`send_otp` / `pay_offline` / `success`)
2. If the charge call fails outright, try `/transaction/initialize` → authorization URL
3. If both fail → return error

### Error Handling

- 4xx errors: Retry unless 422 (validation error)
- 5xx errors: Retry with backoff
- Network timeouts: Retry with backoff
- Invalid response: Retry with backoff

## Frontend Integration

### Subscription Payment (app/billing/page.tsx)

```typescript
onSuccess: (res) => {
  setPaymentReference(res.reference);
  setPaymentMessage(res.displayMessage);
  setAwaitingOtp(!!res.awaitingOtp);

  // If authorization URL provided, redirect for payment
  if (res.authorizationUrl) {
    window.location.href = res.authorizationUrl;
  }
}
```

When `awaitingOtp` is true, the page renders a code input instead of the polling spinner and
submits it via `useSubmitSubscriptionOtp` (`/api/subscriptions/submit-otp`) before falling through
to the normal polling state.

### Patient Check Payment (components/patient-check/UnlockCheckStep.tsx)

Same pattern — OTP input via `useSubmitCheckOtp` (`/api/payments/submit-otp`), and redirects to the
authorization URL if provided.

## Payment Status Tracking

### Option A (OTP relay)
- Client shows a code-entry input immediately (no spinner)
- Customer types in the code Paystack sent them
- Client submits it via `/submit-otp`; on success, falls through to Option B's polling

### Option B (Native prompt)
- Payment prompt appears on user's phone
- User approves/denies on phone
- Server receives webhook notification
- Client polls `/api/subscriptions/verify` every 3 seconds
- Status updates when webhook processes or verify detects completion

### Option C (Authorization URL)
- User completes payment in Paystack checkout
- User redirected back to app
- Client polls for status confirmation
- Webhook provides final confirmation

## Testing Recommendations

### Manual Testing

1. **MTN Mobile Money**
   ```
   Phone: 0244123456
   Provider: mtn
   Amount: GHS 500.00
   ```
   - Should see payment prompt on actual phone
   - Or redirect to authorization URL

2. **Vodafone Cash**
   ```
   Phone: 0255123456
   Provider: vod
   Amount: GHS 500.00
   ```

3. **AirtelTigo Money**
   ```
   Phone: 0270123456
   Provider: atl
   Amount: GHS 500.00
   ```

### Webhook Testing

Configure Paystack dashboard webhook to point to:
```
https://yourdomain.com/api/payments/paystack-webhook
```

The webhook should trigger after payment approval on phone.

### Redirect Testing (if Authorization URL is used)

1. Payment should redirect to Paystack checkout page
2. User completes payment in Paystack UI
3. After completion, Paystack redirects back (URL configured in Paystack dashboard)
4. App polls for status and unlocks subscription/check

## Configuration

### Environment Variables

```env
PAYSTACK_SECRET_KEY=sk_live_xxxxx  # From Paystack dashboard
```

### Paystack Dashboard Setup

1. Go to Settings → API Keys & Webhooks
2. Set Webhook URL to: `https://yourdomain.com/api/payments/paystack-webhook`
3. Ensure webhook is enabled
4. For authorization URL redirects, set Return/Cancel URLs in your Paystack settings

## Troubleshooting

### Payment Gets Stuck on "Pending"

- Check that webhook is configured in Paystack dashboard
- Verify webhook URL is correct and reachable
- Client should still poll `/api/subscriptions/verify` even if webhook fails
- Check server logs for webhook processing errors

### Authorization URL Not Provided

- Charge endpoint may have succeeded (direct prompt sent)
- Check Paystack account configuration
- Verify payment channels are enabled

### User Doesn't Receive Prompt

- Verify phone number is correct (should be in E.164 format: +233...)
- Check that Mobile Money is active on the phone
- Sufficient balance should be available
- Confirm provider (mtn/vod/atl) is correct

### Code Entered but Payment Still Stuck

- Confirm the client actually called `/api/subscriptions/submit-otp` (or
  `/api/payments/submit-otp`) — check `awaitingOtp` was true in the initiate response and the OTP
  form actually rendered
- If `submit-otp` returned `ok: false`, the message is Paystack's own rejection reason (wrong
  code, expired, etc.) — the customer needs to retry with a fresh code, not just resubmit the same
  one
- `submit-otp` never resolves the payment row itself; if it returned `ok: true` but the poll still
  shows pending, that's the same "webhook/verify hasn't caught up yet" case as any other charge

### Payment Shows Failed Immediately

- Check Paystack account balance/limits
- Verify amount is within daily/transaction limits
- Check Mobile Money balance on user's phone
- Confirm phone number is linked to Mobile Money account

## Files Modified

1. `lib/payments/paystackCharge.ts` — Shared charge/submit-otp/initialize logic, branches on
   `data.status` (new)
2. `app/api/subscriptions/initiate/route.ts` / `app/api/payments/initiate/route.ts` — Use the
   shared helper, return `awaitingOtp`
3. `app/api/subscriptions/submit-otp/route.ts` / `app/api/payments/submit-otp/route.ts` — Relay
   the OTP to Paystack (new)
4. `app/billing/page.tsx` / `components/patient-check/UnlockCheckStep.tsx` — OTP entry step
5. `lib/data/repositories/subscriptionRepository.ts` / `checkQuotaRepository.ts` — `awaitingOtp` in
   the initiate return type, new `submitSubscriptionOtp`/`submitCheckOtp` functions

## Migration Notes

- No database migrations required
- Webhook configuration must be set in Paystack dashboard (not in code)
- Existing pending payments continue to work
- Payment reference format unchanged
- All changes are backward compatible

## Next Steps

1. Update Paystack webhook URL in dashboard
2. Test with real Mobile Money accounts in sandbox/live
3. Verify phone receives prompts for direct charge flow
4. Test authorization URL redirect flow
5. Monitor logs for any charge/initialize endpoint errors
