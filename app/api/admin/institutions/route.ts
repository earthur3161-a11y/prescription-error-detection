import "server-only";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";

const bodySchema = z.object({ name: z.string().min(1) });

/**
 * POST /api/admin/institutions — creates a new institution. Superadmin-only:
 * the primary path is via access-request approval (which creates the
 * institution automatically), this route exists for direct provisioning.
 */
export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", message: "A name is required." }, { status: 422 });
  }

  const { data: institution, error } = await supabaseService
    .from("institutions")
    .insert({ name: parsed.data.name, created_by: callerData.user.id })
    .select()
    .single();
  if (error || !institution) {
    return Response.json(
      { error: "internal_error", message: error?.message ?? "Couldn't create the institution." },
      { status: 500 }
    );
  }

  return Response.json({ id: institution.id, name: institution.name }, { status: 201 });
}
