import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";

// Deliberately NOT validated at module scope — same lesson as
// send-email-hook: a build-time throw here would fail the entire Vercel
// deployment, not just this route. Checked per-request instead (though this
// route has no env vars of its own to check — kept for consistency and in
// case Paystack/email-verification env checks are added here later).

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["prescriber", "pharmacist"]),
});

const ROLE_TITLE: Record<"prescriber" | "pharmacist", string> = {
  prescriber: "Physician",
  pharmacist: "Pharmacist",
};

const ROLE_PRODUCT: Record<"prescriber" | "pharmacist", "physician_portal" | "pharmacy_portal"> = {
  prescriber: "physician_portal",
  pharmacist: "pharmacy_portal",
};

/**
 * POST /api/auth/signup — self-serve account creation for the Physician and
 * Pharmacy Portals. A plain client-side supabase.auth.signUp() can never set
 * app_metadata (only client-editable user_metadata), and role has always
 * lived in app_metadata specifically to prevent privilege escalation — so
 * this needs the same service-role, two-step create-then-set-role pattern
 * already used by the access-request approval route. New accounts start
 * with no subscription (created by the initiate-payment route on first
 * charge, not here) — the client sends them straight to /billing.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", message: "A name, valid email, password (8+ characters), and role are required." },
      { status: 422 }
    );
  }
  const { email, password, name, role } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const { data: created, error: createError } = await supabaseService.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createError || !created.user) {
    const alreadyExists = /already registered|already exists|already been registered/i.test(
      createError?.message ?? ""
    );
    return Response.json(
      {
        error: alreadyExists ? "email_already_registered" : "signup_failed",
        message: alreadyExists ? "This email already has an account." : (createError?.message ?? "Couldn't create the account."),
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  const { error: metadataError } = await supabaseService.auth.admin.updateUserById(created.user.id, {
    app_metadata: { role },
  });
  if (metadataError) {
    return Response.json({ error: "role_assignment_failed", message: metadataError.message }, { status: 500 });
  }

  const { error: profileError } = await supabaseService.from("profiles").upsert({
    id: created.user.id,
    role,
    name,
    title: ROLE_TITLE[role],
    status: "active",
  });
  if (profileError) {
    return Response.json({ error: "profile_creation_failed", message: profileError.message }, { status: 500 });
  }

  // Seed the (inactive) subscription row up front so get_my_subscription_status
  // has something to return immediately after signup, before any payment.
  const { error: subscriptionError } = await supabaseService
    .from("subscriptions")
    .upsert({ owner_id: created.user.id, product: ROLE_PRODUCT[role] }, { onConflict: "owner_id,product" });
  if (subscriptionError) {
    return Response.json({ error: "subscription_setup_failed", message: subscriptionError.message }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
