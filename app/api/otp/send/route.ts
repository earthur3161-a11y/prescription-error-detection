import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { isOtpDemoModeAllowed } from "@/lib/utils/otpDemoMode";
import { generateOtpCode, hashOtpCode } from "@/lib/utils/otpCode";

// Deliberately NOT validated at module scope — same reasoning as
// send-email-hook: a build-time throw here would fail the entire Vercel
// deployment, not just this route. Checked per-request instead.

const bodySchema = z.object({ phone: z.string().min(6) });

const OTP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const OTP_RATE_LIMIT_MAX_SENDS = 3;
const OTP_CODE_EXPIRY_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "A valid phone number is required." }, { status: 422 });
  }
  const phone = parsed.data.phone;

  // Same simulated-verification convention already used by the seeded demo
  // logins' MFA step (components/auth/PortalLoginForm.tsx), but hardened
  // further: see lib/utils/otpDemoMode.ts for why this can never activate on
  // an actual Vercel production deployment, regardless of the dev-accounts
  // flag's value. No SMS provider credentials needed at all in this mode.
  if (isOtpDemoModeAllowed()) {
    return Response.json({ sent: true, demoMode: true });
  }

  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;
  if (!apiKey || !username) {
    console.error("[otp/send] Missing AFRICASTALKING_API_KEY / AFRICASTALKING_USERNAME.");
    return Response.json(
      { error: "not_configured", message: "Phone verification is not fully configured yet." },
      { status: 500 }
    );
  }

  const { data: quota, error: quotaError } = await supabaseService.rpc("get_check_quota", {
    p_phone: phone,
  });
  if (quotaError) {
    console.error("[otp/send] get_check_quota failed:", quotaError);
    return Response.json({ error: "internal_error", message: "Couldn't check verification status." }, { status: 500 });
  }
  if (quota?.[0]?.phone_verified) {
    return Response.json({ alreadyVerified: true });
  }

  // Rate-limit sends per phone — cheap abuse mitigation independent of
  // whatever the SMS provider does on its own end. Uses self_check_accounts
  // directly via the service-role client (no RPC needed — this route
  // already has privileged access).
  const { data: account } = await supabaseService
    .from("self_check_accounts")
    .select("otp_send_count, otp_last_sent_at")
    .eq("phone", phone)
    .maybeSingle();

  const now = Date.now();
  const withinWindow =
    account?.otp_last_sent_at && now - new Date(account.otp_last_sent_at).getTime() < OTP_RATE_LIMIT_WINDOW_MS;
  const sendsInWindow = withinWindow ? account!.otp_send_count : 0;

  if (sendsInWindow >= OTP_RATE_LIMIT_MAX_SENDS) {
    return Response.json(
      { error: "rate_limited", message: "Too many verification codes requested. Try again later." },
      { status: 429 }
    );
  }

  // Africa's Talking is a raw SMS-send API with no built-in OTP/Verify
  // equivalent (unlike the previous provider), so code generation, expiry,
  // and brute-force attempt-limiting on the verify side (app/api/otp/verify)
  // are this app's own responsibility now — see 0023_self_hosted_otp_codes.sql.
  const code = generateOtpCode();

  // "sandbox" is Africa's Talking's own documented convention for routing to
  // their free, no-real-delivery sandbox environment during development —
  // not a separate flag, the username value itself selects the endpoint.
  const isSandbox = username === "sandbox";

  // A misconfigured AFRICASTALKING_USERNAME left as "sandbox" on the real
  // production deployment is a dangerous silent failure: the sandbox API
  // returns the exact same "Success" shape as live delivery, so this route
  // would keep telling real patients { sent: true } while no SMS ever
  // reaches their phone — indistinguishable from working, from both the
  // patient's and this route's own point of view, without this check.
  // Refusing loudly here (same not_configured shape callers already handle)
  // is the only way this failure mode surfaces instead of running silently.
  if (isSandbox && process.env.VERCEL_ENV === "production") {
    console.error("[otp/send] AFRICASTALKING_USERNAME is \"sandbox\" on a production deployment — refusing to fake-send.");
    return Response.json(
      { error: "not_configured", message: "Phone verification is not fully configured yet." },
      { status: 500 }
    );
  }

  const smsRes = await fetch(
    isSandbox
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging",
    {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        username,
        to: phone,
        message: `Your MediGuard verification code is ${code}. It expires in 10 minutes.`,
      }),
    }
  );

  if (!smsRes.ok) {
    const errBody = await smsRes.text();
    console.error("[otp/send] Africa's Talking send failed:", smsRes.status, errBody);
    return Response.json({ error: "sms_send_failed", message: "Couldn't send the verification code." }, { status: 502 });
  }

  const smsBody = (await smsRes.json()) as {
    SMSMessageData?: { Recipients?: { status?: string }[] };
  };
  const recipientStatus = smsBody.SMSMessageData?.Recipients?.[0]?.status;
  if (recipientStatus !== "Success") {
    console.error("[otp/send] Africa's Talking did not report success:", JSON.stringify(smsBody));
    return Response.json({ error: "sms_send_failed", message: "Couldn't send the verification code." }, { status: 502 });
  }

  await supabaseService.from("self_check_accounts").upsert(
    {
      phone,
      otp_send_count: sendsInWindow + 1,
      otp_last_sent_at: new Date().toISOString(),
      otp_code_hash: hashOtpCode(phone, code),
      otp_expires_at: new Date(now + OTP_CODE_EXPIRY_MS).toISOString(),
      otp_verify_attempts: 0,
    },
    { onConflict: "phone" }
  );

  return Response.json({ sent: true });
}
