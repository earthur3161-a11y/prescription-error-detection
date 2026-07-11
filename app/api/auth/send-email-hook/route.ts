import "server-only";
import { Webhook } from "standardwebhooks";

// Supabase Auth's "Send Email" hook: instead of Supabase talking SMTP to an
// email provider directly (which timed out reaching Resend's SMTP relay from
// this project — confirmed via direct testing, not assumed), Supabase POSTs
// a signed payload here whenever it needs to send an auth email, and this
// route sends it itself via Resend's HTTPS API. HTTPS/443 egress is far less
// likely to be blocked than SMTP's 465/587, and this is the officially
// documented workaround for exactly this situation.
//
// Configure in Supabase Dashboard -> Authentication -> Hooks -> "Send Email
// hook" -> HTTPS -> paste this route's deployed URL -> Generate Secret (the
// result, formatted "v1,whsec_...", is SEND_EMAIL_HOOK_SECRET below).

const HOOK_SECRET_ENV = process.env.SEND_EMAIL_HOOK_SECRET;
const RESEND_API_KEY_ENV = process.env.RESEND_API_KEY;
const SUPABASE_URL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!HOOK_SECRET_ENV || !RESEND_API_KEY_ENV || !SUPABASE_URL_ENV) {
  throw new Error(
    "Missing SEND_EMAIL_HOOK_SECRET / RESEND_API_KEY / NEXT_PUBLIC_SUPABASE_URL. " +
      "SEND_EMAIL_HOOK_SECRET comes from Supabase Dashboard -> Authentication -> Hooks " +
      "when you create the Send Email hook; RESEND_API_KEY from the Resend dashboard. " +
      "Set both as server-side environment variables in Vercel (never NEXT_PUBLIC_)."
  );
}

// Re-bound as plain `string` (not `string | undefined`) so TypeScript keeps
// them narrowed inside the nested POST closure below — module-level `const`
// narrowing from the guard above doesn't survive across a function boundary.
const HOOK_SECRET: string = HOOK_SECRET_ENV;
const RESEND_API_KEY: string = RESEND_API_KEY_ENV;
const SUPABASE_URL: string = SUPABASE_URL_ENV;

interface HookUser {
  email: string;
}

interface HookEmailData {
  token_hash: string;
  redirect_to: string;
  email_action_type: "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "reauthentication";
}

const EMAIL_COPY: Record<HookEmailData["email_action_type"], { subject: string; heading: string; cta: string }> = {
  invite: {
    subject: "You've been invited to MediGuard",
    heading: "You've been invited to MediGuard",
    cta: "Accept invite & set your password",
  },
  recovery: {
    subject: "Reset your MediGuard password",
    heading: "Reset your password",
    cta: "Reset password",
  },
  magiclink: {
    subject: "Your MediGuard sign-in link",
    heading: "Sign in to MediGuard",
    cta: "Sign in",
  },
  signup: {
    subject: "Confirm your MediGuard account",
    heading: "Confirm your account",
    cta: "Confirm account",
  },
  email_change: {
    subject: "Confirm your new MediGuard email",
    heading: "Confirm your new email address",
    cta: "Confirm new email",
  },
  reauthentication: {
    subject: "Confirm it's you",
    heading: "Confirm it's you",
    cta: "Confirm",
  },
};

function buildActionLink(emailData: HookEmailData): string {
  const params = new URLSearchParams({
    token: emailData.token_hash,
    type: emailData.email_action_type,
    redirect_to: emailData.redirect_to,
  });
  return `${SUPABASE_URL}/auth/v1/verify?${params.toString()}`;
}

function buildHtml(user: HookUser, emailData: HookEmailData): { subject: string; html: string } {
  const copy = EMAIL_COPY[emailData.email_action_type];
  const link = buildActionLink(emailData);
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; color: #0f172a;">${copy.heading}</h1>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        This link is for ${user.email}. If you weren't expecting this, you can ignore this email.
      </p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
          ${copy.cta}
        </a>
      </p>
      <p style="color: #94a3b8; font-size: 12px;">
        If the button doesn't work, copy and paste this link: ${link}
      </p>
    </div>
  `.trim();
  return { subject: copy.subject, html };
}

export async function POST(request: Request) {
  const payload = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let verified: { user: HookUser; email_data: HookEmailData };
  try {
    const wh = new Webhook(HOOK_SECRET.replace("v1,whsec_", ""));
    verified = wh.verify(payload, headers) as { user: HookUser; email_data: HookEmailData };
  } catch (err) {
    console.error("[send-email-hook] signature verification failed:", err);
    return Response.json(
      { error: { http_code: 401, message: "Invalid webhook signature." } },
      { status: 401 }
    );
  }

  const { user, email_data: emailData } = verified;
  const { subject, html } = buildHtml(user, emailData);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MediGuard <onboarding@resend.dev>",
      to: [user.email],
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const body = await resendRes.text();
    console.error("[send-email-hook] Resend send failed:", resendRes.status, body);
    return Response.json(
      { error: { http_code: 500, message: "Failed to send email via Resend." } },
      { status: 500 }
    );
  }

  return new Response(null, { status: 200 });
}
