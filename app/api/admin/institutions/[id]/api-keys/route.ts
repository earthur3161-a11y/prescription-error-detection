import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { generateApiKey } from "@/lib/integration/apiKeys";

const bodySchema = z.object({ mode: z.enum(["live", "sandbox"]) });

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
 * POST /api/admin/institutions/[id]/api-keys — mints a real key. The raw
 * key is returned exactly once, in this response, and never persisted
 * anywhere — only its sha256 hash is stored (institution_api_keys.key_hash).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/admin/institutions/[id]/api-keys">) {
  const { id: institutionId } = await ctx.params;

  const auth = await authorizeCaller(request, institutionId);
  if (!auth.ok) {
    return Response.json({ error: "unauthorized", message: auth.message }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "mode must be 'live' or 'sandbox'." }, { status: 422 });
  }

  const { rawKey, keyPrefix, keyHash } = generateApiKey(parsed.data.mode);
  const { data: keyRow, error } = await supabaseService
    .from("institution_api_keys")
    .insert({ institution_id: institutionId, mode: parsed.data.mode, key_prefix: keyPrefix, key_hash: keyHash })
    .select("id, mode, key_prefix, created_at")
    .single();
  if (error || !keyRow) {
    return Response.json(
      { error: "internal_error", message: error?.message ?? "Couldn't create the API key." },
      { status: 500 }
    );
  }

  return Response.json(
    { id: keyRow.id, mode: keyRow.mode, keyPrefix: keyRow.key_prefix, createdAt: keyRow.created_at, rawKey },
    { status: 201 }
  );
}
