import "server-only";
import { supabaseService } from "@/lib/supabase/serviceClient";

/** Superadmin, or an admin whose own app_metadata.institution_id matches. */
async function authorizeCaller(
  request: Request,
  institutionId: string
): Promise<{ ok: boolean; status?: number; message?: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, message: "Missing bearer token." };
  const { data: callerData, error: callerError } = await supabaseService.auth.getUser(token);
  if (callerError || !callerData.user) return { ok: false, status: 401, message: "Invalid or expired session." };
  const role = callerData.user.app_metadata?.role;
  if (role === "superadmin") return { ok: true };
  if (role === "admin" && callerData.user.app_metadata?.institution_id === institutionId) return { ok: true };
  return { ok: false, status: 403, message: "Not authorized for this institution." };
}

/**
 * DELETE /api/admin/institutions/[id]/api-keys/[keyId] — revokes a key
 * (sets revoked_at; the row stays for audit history, never hard-deleted).
 * authorizeApiKey() checks revoked_at on every screening call, so this
 * takes effect immediately.
 */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/admin/institutions/[id]/api-keys/[keyId]">
) {
  const { id: institutionId, keyId } = await ctx.params;

  const auth = await authorizeCaller(request, institutionId);
  if (!auth.ok) {
    return Response.json({ error: "unauthorized", message: auth.message }, { status: auth.status });
  }

  const { data, error } = await supabaseService
    .from("institution_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("institution_id", institutionId)
    .select("id");
  if (error) {
    return Response.json({ error: "internal_error", message: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return Response.json({ error: "not_found", message: "No matching API key for this institution." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
