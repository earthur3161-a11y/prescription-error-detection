import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";

// Deliberately NOT validated at module scope — same reasoning as
// send-email-hook: a build-time throw here would fail the entire Vercel
// deployment, not just this route. Checked per-request instead.

const bodySchema = z.object({ phone: z.string().min(6) });

const OTP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const OTP_RATE_LIMIT_MAX_SENDS = 3;

export async function POST(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !verifyServiceSid) {
    console.error("[otp/send] Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID.");
    return Response.json(
      { error: "not_configured", message: "Phone verification is not fully configured yet." },
      { status: 500 }
    );
  }

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

  const { data: quota, error: quotaError } = await supabaseService.rpc("get_check_quota", {
    p_phone: parsed.data.phone,
  });
  if (quotaError) {
    console.error("[otp/send] get_check_quota failed:", quotaError);
    return Response.json({ error: "internal_error", message: "Couldn't check verification status." }, { status: 500 });
  }
  if (quota?.[0]?.phone_verified) {
    return Response.json({ alreadyVerified: true });
  }

  // Rate-limit sends per phone — cheap abuse mitigation independent of
  // Twilio's own per-service rate limiting. Uses self_check_accounts
  // directly via the service-role client (no RPC needed — this route
  // already has privileged access).
  const { data: account } = await supabaseService
    .from("self_check_accounts")
    .select("otp_send_count, otp_last_sent_at")
    .eq("phone", parsed.data.phone)
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

  const twilioRes = await fetch(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: parsed.data.phone, Channel: "sms" }),
    }
  );

  if (!twilioRes.ok) {
    const errBody = await twilioRes.text();
    console.error("[otp/send] Twilio Verify send failed:", twilioRes.status, errBody);
    return Response.json({ error: "sms_send_failed", message: "Couldn't send the verification code." }, { status: 502 });
  }

  await supabaseService
    .from("self_check_accounts")
    .upsert(
      { phone: parsed.data.phone, otp_send_count: sendsInWindow + 1, otp_last_sent_at: new Date().toISOString() },
      { onConflict: "phone" }
    );

  return Response.json({ sent: true });
}
