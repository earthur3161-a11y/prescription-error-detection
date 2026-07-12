import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";

const bodySchema = z.object({ phone: z.string().min(6), code: z.string().min(3).max(10) });

export async function POST(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !verifyServiceSid) {
    console.error("[otp/verify] Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_VERIFY_SERVICE_SID.");
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
    return Response.json({ error: "invalid_request", message: "A phone number and code are required." }, { status: 422 });
  }

  const twilioRes = await fetch(
    `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: parsed.data.phone, Code: parsed.data.code }),
    }
  );

  if (!twilioRes.ok) {
    // Twilio returns 404 for an unknown/expired verification and 429 for
    // too-many-attempts — both are "not verified", not a server error.
    return Response.json({ verified: false });
  }

  const result = (await twilioRes.json()) as { status?: string };
  if (result.status !== "approved") {
    return Response.json({ verified: false });
  }

  // The only writer of phone_verified: a client can never set this itself,
  // only Twilio having actually confirmed the code gets here.
  const { error } = await supabaseService
    .from("self_check_accounts")
    .upsert({ phone: parsed.data.phone, phone_verified: true }, { onConflict: "phone" });

  if (error) {
    console.error("[otp/verify] Failed to mark phone verified:", error);
    return Response.json({ error: "internal_error", message: "Verification succeeded but couldn't be saved." }, { status: 500 });
  }

  return Response.json({ verified: true });
}
