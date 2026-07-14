import { supabase } from "../../supabase/client";
import type { InstitutionApiKeyPublicRow, InstitutionRow } from "../../supabase/types";
import type { ApiKeyMode, EnforcementLevel, Institution, InstitutionApiKey } from "../../types";

function mapInstitution(row: InstitutionRow): Institution {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    enforcementLevel: row.enforcement_level,
    createdAt: row.created_at,
  };
}

function mapKey(row: InstitutionApiKeyPublicRow): InstitutionApiKey {
  return {
    id: row.id,
    institutionId: row.institution_id,
    mode: row.mode,
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at ?? undefined,
    revokedAt: row.revoked_at ?? undefined,
    createdAt: row.created_at,
  };
}

/** RLS already scopes institutions to the caller's own app_metadata.institution_id, so this is at most one row. */
export async function getMyInstitution(): Promise<Institution | null> {
  const { data, error } = await supabase.from("institutions").select("*").maybeSingle();
  if (error) throw error;
  return data ? mapInstitution(data) : null;
}

export async function listMyApiKeys(): Promise<InstitutionApiKey[]> {
  const { data, error } = await supabase
    .from("institution_api_keys_public")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapKey);
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("You need to be signed in.");
  return { Authorization: `Bearer ${accessToken}` };
}

/** The raw key is returned exactly once, here — never persisted client-side, never retrievable again. */
export async function mintApiKey(
  institutionId: string,
  mode: ApiKeyMode
): Promise<{ id: string; mode: ApiKeyMode; keyPrefix: string; rawKey: string }> {
  const res = await fetch(`/api/admin/institutions/${institutionId}/api-keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ mode }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Couldn't create the API key.");
  return body;
}

export async function revokeApiKey(institutionId: string, keyId: string): Promise<void> {
  const res = await fetch(`/api/admin/institutions/${institutionId}/api-keys/${keyId}`, {
    method: "DELETE",
    headers: await authHeader(),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.message ?? "Couldn't revoke the API key.");
  }
}

export async function updateMyEnforcementLevel(level: EnforcementLevel): Promise<void> {
  const { error } = await supabase.rpc("update_my_institution_enforcement_level", { p_level: level });
  if (error) throw error;
}
