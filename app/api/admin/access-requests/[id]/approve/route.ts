import type { NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { generateApiKey } from "@/lib/integration/apiKeys";
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
 *
 * Institution resolution now applies to all three roles (Decision 1/2):
 * every access_requests row is, by definition, an institutional
 * affiliation request — the separate instant-activate /physician/signup
 * and /pharmacy/signup path is how an independent practitioner gets an
 * account with no institution_id at all, and never touches this route.
 * Optional JSON body `{ confirmedInstitutionName?: string }` lets the
 * approving Super Admin correct a typo'd/inconsistent free-text institution
 * name before it's resolved to a real institutions row — defaults to the
 * request's own submitted value if omitted. Resolution is a case-insensitive
 * exact-name lookup, reusing an existing institution when one already
 * matches rather than always minting a new one, so staff who all typed the
 * same hospital name end up sharing one real institution_id.
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

  let confirmedInstitutionName: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.confirmedInstitutionName === "string" && body.confirmedInstitutionName.trim()) {
      confirmedInstitutionName = body.confirmedInstitutionName.trim();
    }
  } catch {
    // No body (or non-JSON) is fine — falls back to the request's own institution field below.
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

  // Resolve (reuse-or-create) a real institution for every role now — the
  // free-text `institution` field is what finally becomes load-bearing.
  const institutionName = confirmedInstitutionName ?? reqRow.institution;
  const { data: existingInstitution, error: lookupError } = await supabaseService
    .from("institutions")
    .select("id")
    .ilike("name", institutionName)
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    return Response.json(
      { error: "institution_lookup_failed", message: lookupError.message },
      { status: 500 }
    );
  }

  let institutionId: string;
  if (existingInstitution) {
    institutionId = existingInstitution.id;
  } else {
    const { data: institution, error: institutionError } = await supabaseService
      .from("institutions")
      .insert({ name: institutionName, created_by: callerData.user.id })
      .select("id")
      .single();
    if (institutionError || !institution) {
      return Response.json(
        { error: "institution_creation_failed", message: institutionError?.message ?? "Couldn't create the institution." },
        { status: 500 }
      );
    }
    institutionId = institution.id;
  }

  // inviteUserByEmail's `data` option sets user_metadata (client-editable
  // later by that user) — role and institution_id must live in app_metadata
  // instead, which is only ever writable through this admin API, never by
  // the signed-in user.
  const { error: metadataError } = await supabaseService.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { role: reqRow.requested_role, institution_id: institutionId },
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
    institution: institutionName,
    institution_id: institutionId,
  });
  if (profileError) {
    return Response.json({ error: "profile_creation_failed", message: profileError.message }, { status: 500 });
  }

  // One initial sandbox key so a newly-provisioned Facility Admin has
  // something to test with immediately — specific to that role's actual
  // API-integration purpose, not meaningful for prescriber/pharmacist.
  if (reqRow.requested_role === "admin") {
    const { keyPrefix, keyHash } = generateApiKey("sandbox");
    await supabaseService
      .from("institution_api_keys")
      .insert({ institution_id: institutionId, mode: "sandbox", key_prefix: keyPrefix, key_hash: keyHash });
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
