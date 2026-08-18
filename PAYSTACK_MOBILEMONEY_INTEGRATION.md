# Paystack Mobile Money Payment Integration

This document explains the real-world Mobile Money payment integration with Paystack for Ghana.

## Overview

The payment system now uses Paystack's proper Mobile Money integration that prompts users directly on their phone to approve payments, rather than asking them to enter USSD codes.

## How It Works

### Payment Flow

1. **User Initiates Payment**
   - User enters phone number and selects Mobile Money provider (MTN/Vodafone/AirtelTigo)
   - Client sends request to `/api/subscriptions/initiate` or `/api/payments/initiate`

2. **Server Initializes Payment**
   - Server attempts charge endpoint first (for direct Mobile Money prompt)
   - If charge fails, falls back to initialize endpoint (for authorization URL)

3. **Two Possible Outcomes**

   **Option A: Direct Prompt (Charge Endpoint)**
   - Paystack sends a prompt directly to the customer's phone
   - Customer approves payment on their phone
   - Webhook notifies server of payment completion
   - Client polls `/api/subscriptions/verify` for status

   **Option B: Authorization URL (Initialize Endpoint)**
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
  "displayMessage": "Payment prompt sent to your phone. Check your messages."
}
```

### `/api/payments/initiate` Response

Same structure as subscriptions initiate.

## Implementation Details

### Retry Logic

- Both endpoints retry failed requests up to 2 times with exponential backoff
- Transient errors (network, timeouts) trigger retry
- Permanent errors (invalid config) fail immediately

### Fallback Strategy

1. Try `/charge` endpoint → direct Mobile Money prompt
2. If charge fails, try `/transaction/initialize` → authorization URL
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
  
  // If authorization URL provided, redirect for payment
  if (res.authorizationUrl) {
    window.location.href = res.authorizationUrl;
  }
}
```

### Patient Check Payment (components/patient-check/UnlockCheckStep.tsx)

Same pattern - redirects to authorization URL if provided.

## Payment Status Tracking

### Option A (Direct Prompt)
- Payment prompt appears on user's phone
- User approves/denies on phone
- Server receives webhook notification
- Client polls `/api/subscriptions/verify` every 3 seconds
- Status updates when webhook processes or verify detects completion

### Option B (Authorization URL)
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

### Payment Shows Failed Immediately

- Check Paystack account balance/limits
- Verify amount is within daily/transaction limits
- Check Mobile Money balance on user's phone
- Confirm phone number is linked to Mobile Money account

## Files Modified

1. `app/api/subscriptions/initiate/route.ts` — Retry + proper charge/initialize flow
2. `app/api/payments/initiate/route.ts` — Same for patient self-check
3. `app/billing/page.tsx` — Handle authorization URL redirect
4. `components/patient-check/UnlockCheckStep.tsx` — Handle authorization URL redirect
5. `lib/data/repositories/subscriptionRepository.ts` — Updated return type

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
