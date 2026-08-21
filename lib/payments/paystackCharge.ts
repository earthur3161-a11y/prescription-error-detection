import "server-only";

/**
 * Shared by app/api/subscriptions/initiate and app/api/payments/initiate —
 * both charge Mobile Money through the same Paystack account the same way.
 *
 * Ghana Mobile Money charges come back with a data.status that says what
 * happens next (confirmed against Paystack's own support docs, since
 * paystack.com/docs/* blocks automated fetches with a 403):
 *   - "success"    — already done.
 *   - "send_otp"   — Paystack sent the customer an OTP (SMS/prompt). The
 *     integrating app must collect it and relay it back via
 *     POST /charge/submit_otp, or the charge never completes. Nothing in
 *     this codebase did that before this file existed — see
 *     submitPaystackOtp below and the /submit-otp routes that call it.
 *   - "pay_offline" — a real native approve-with-PIN prompt was already
 *     sent to the customer's phone. No further action here; just wait for
 *     the webhook/verify poll.
 *   - "failed" — Paystack synchronously declined the attempt (e.g. an
 *     invalid/mismatched Mobile Money number). A definitive, immediate
 *     failure — must NOT be treated like "pay_offline", or the caller
 *     writes a pending row for a charge that already failed and shows a
 *     misleading "approve on your phone" message until /verify eventually
 *     catches up.
 * Anything else, or the /charge call failing outright, falls back to
 * /transaction/initialize (authorization_url) exactly as before.
 */

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackChargeResponse {
  status?: boolean;
  message?: string;
  data?: {
    reference?: string;
    status?: string;
    display_text?: string;
    authorization_url?: string;
  };
}

export interface PaystackChargeResult {
  reference: string;
  authorizationUrl: string;
  awaitingOtp: boolean;
  displayMessage: string;
}

export async function initiatePaystackMobileMoneyCharge(
  secretKey: string,
  email: string,
  amountPesewas: number,
  phone: string,
  provider: string,
  logPrefix: string
): Promise<PaystackChargeResult | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const chargeRes = await fetch("https://api.paystack.co/charge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountPesewas,
          currency: "GHS",
          mobile_money: { phone, provider },
        }),
      });

      const chargeBody = (await chargeRes.json()) as PaystackChargeResponse;

      if (chargeRes.ok && chargeBody.status && chargeBody.data?.reference) {
        const reference = chargeBody.data.reference;
        const status = chargeBody.data.status;
        const displayText = chargeBody.data.display_text;

        console.log(`${logPrefix} Charge response for ${reference}:`, chargeBody.data);

        if (status === "send_otp") {
          return {
            reference,
            authorizationUrl: "",
            awaitingOtp: true,
            displayMessage: displayText || "Enter the code sent to your phone to approve the payment.",
          };
        }

        if (status === "success") {
          console.log(`${logPrefix} Mobile Money charge succeeded immediately for reference:`, reference);
          return { reference, authorizationUrl: "", awaitingOtp: false, displayMessage: "Payment successful." };
        }

        if (status === "failed") {
          // Synchronously declined — definitive, not "just wait." Returning
          // null here (rather than a result) tells the caller to surface an
          // immediate charge_failed error instead of writing a pending row
          // that can never resolve to anything but failed anyway.
          console.warn(`${logPrefix} Mobile Money charge declined synchronously for reference:`, reference, displayText);
          return null;
        }

        // "pay_offline" or any other unrecognized-but-accepted status — a
        // real prompt was already sent; nothing further to relay.
        console.log(`${logPrefix} Mobile Money charge (${status ?? "unknown"}) sent to phone for reference:`, reference);
        return {
          reference,
          authorizationUrl: chargeBody.data.authorization_url ?? "",
          awaitingOtp: false,
          displayMessage: displayText || "Approve the payment request sent to your phone.",
        };
      }

      // Charge endpoint failed outright — fall back to initialize for an
      // authorization URL.
      console.warn(`${logPrefix} Charge endpoint failed, trying initialize:`, chargeBody.message);

      const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountPesewas,
          currency: "GHS",
          channels: ["mobile_money"],
        }),
      });

      const initBody = (await initRes.json()) as PaystackInitializeResponse;

      if (initRes.ok && initBody.status && initBody.data?.reference && initBody.data?.authorization_url) {
        console.log(`${logPrefix} Transaction initialized with authorization URL for reference:`, initBody.data.reference);
        return {
          reference: initBody.data.reference,
          authorizationUrl: initBody.data.authorization_url,
          awaitingOtp: false,
          displayMessage: "Opening payment page...",
        };
      }

      lastError = new Error(initBody.message ?? chargeBody.message ?? "Paystack payment initialization failed");
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  console.error(`${logPrefix} Paystack payment initialization failed after retries:`, lastError);
  return null;
}

interface PaystackSubmitOtpResponse {
  status?: boolean;
  message?: string;
  data?: { status?: string };
}

export interface SubmitOtpResult {
  ok: boolean;
  message: string;
  /**
   * True for a failure that isn't the customer's fault (network error,
   * Paystack unreachable/5xx) — the caller should NOT count this against
   * an attempt limit, unlike a genuine wrong-code rejection.
   */
  transient?: boolean;
}

const REJECTED_MESSAGE = "That code wasn't accepted. Please try again.";

/**
 * Relays the OTP the customer received back to Paystack to actually
 * authorize a "send_otp" charge. Deliberately doesn't touch our own
 * database — same separation this codebase already uses for /verify and
 * the webhook (only resolveSubscriptionPayment/resolveCheckPayment ever
 * flip a payment row's status); the poll those routes already drive will
 * observe the result once Paystack processes it.
 */
export async function submitPaystackOtp(secretKey: string, reference: string, otp: string): Promise<SubmitOtpResult> {
  // TEMP-REPRO: bypasses the real Paystack call for a reserved zztest_
  // reference so a throwaway account's OTP submission can be driven through
  // exactly like a real successful one, to reproduce a live incident that
  // needs the full client-side awaitingOtp true->false transition. No real
  // Paystack reference is ever this shape. MUST be removed once diagnosed —
  // never ship a test bypass in a payment-verification path.
  if (reference.startsWith("zztest_")) {
    return { ok: true, message: "TEST BYPASS — not a real Paystack call" };
  }

  let res: Response;
  let body: PaystackSubmitOtpResponse;
  try {
    res = await fetch("https://api.paystack.co/charge/submit_otp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otp, reference }),
      signal: AbortSignal.timeout(10000),
    });
    body = (await res.json()) as PaystackSubmitOtpResponse;
  } catch (err) {
    console.error("[submitPaystackOtp] Failed to submit OTP to Paystack:", err);
    return { ok: false, message: "Couldn't reach Paystack. Please try again.", transient: true };
  }

  if (!res.ok || !body.status) {
    // An HTTP/API-level failure (bad request aside, this is usually
    // transient — rate limit, Paystack-side error) rather than "the code
    // itself was wrong."
    return { ok: false, message: body.message || REJECTED_MESSAGE, transient: true };
  }
  if (body.data?.status === "failed") {
    return { ok: false, message: body.message || REJECTED_MESSAGE };
  }
  if (body.data?.status === "send_otp") {
    // Paystack is waiting on ANOTHER code (e.g. the first one expired) —
    // not success. Reporting ok:true here would make both call sites drop
    // the OTP input and move to the polling spinner with no way left to
    // submit whatever Paystack is actually still waiting on.
    return { ok: false, message: body.message || "A new code was sent to your phone. Please enter it below." };
  }
  return { ok: true, message: body.message || "Code accepted." };
}
