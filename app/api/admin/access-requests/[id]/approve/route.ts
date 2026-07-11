import type { NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/serviceClient";
import type { AccessRequestRole } from "@/lib/supabase/types";

const ROLE_TITLE: Record<AccessRequestRole, string> = {
  prescriber: "Physician",
  pharmacist: "Pharmacist",
  admin: "Facility Admin",
};

/**
 * POST /api/admin/access-requests/[id]/approve
 *
 * Privileged operation — provisions a real Supabase Auth user and sends
 * them an invite email, both of which require the service-role key and
 * cannot be granted to a browser client via any RLS policy. Verifies the
 * caller is a signed-in superadmin before touching anything.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/access-requests/[id]/approve">
) {
  const { id } = await ctx.params;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return Response.json({ error: "unauthorized", message: "Missing bearer token." }, { status: 401 });
  }

  const { data: callerData, error: callerError } = await supabaseService.auth.getUser(token);
  if (callerError || !callerData.user) {
    return Response.json({ error: "unauthorized", message: "Invalid or expired session." }, { status: 401 });
  }
  if (callerData.user.app_metadata?.role !== "superadmin") {
    return Response.json({ error: "forbidden", message: "Superadmin role required." }, { status: 403 });
  }

  const { data: reqRow, error: reqError } = await supabaseService
    .from("access_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (reqError || !reqRow) {
    return Response.json({ error: "not_found", message: "Access request not found." }, { status: 404 });
  }
  if (reqRow.status !== "pending") {
    return Response.json(
      { error: "already_reviewed", message: "This request has already been reviewed." },
      { status: 409 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: invited, error: inviteError } = await supabaseService.auth.admin.inviteUserByEmail(
    reqRow.email,
    { data: { name: reqRow.full_name }, redirectTo: `${appUrl}/activate` }
  );
  if (inviteError || !invited?.user) {
    const alreadyExists = /already registered|already exists|already been registered/i.test(
      inviteError?.message ?? ""
    );
    return Response.json(
      {
        error: alreadyExists ? "email_already_provisioned" : "invite_failed",
        message: alreadyExists
          ? "This email already has an account."
          : (inviteError?.message ?? "Couldn't send the invite email."),
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  // inviteUserByEmail's `data` option sets user_metadata (client-editable
  // later by that user) — role must live in app_metadata instead, which is
  // only ever writable through this admin API, never by the signed-in user.
  const { error: metadataError } = await supabaseService.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { role: reqRow.requested_role },
  });
  if (metadataError) {
    return Response.json(
      { error: "role_assignment_failed", message: metadataError.message },
      { status: 500 }
    );
  }

  const { error: profileError } = await supabaseService.from("profiles").upsert({
    id: invited.user.id,
    role: reqRow.requested_role,
    name: reqRow.full_name,
    title: ROLE_TITLE[reqRow.requested_role],
    status: "active",
    institution: reqRow.institution,
  });
  if (profileError) {
    return Response.json({ error: "profile_creation_failed", message: profileError.message }, { status: 500 });
  }

  await supabaseService
    .from("access_requests")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: callerData.user.id,
      provisioned_account_id: invited.user.id,
    })
    .eq("id", id);

  return Response.json({ ok: true }, { status: 200 });
}
