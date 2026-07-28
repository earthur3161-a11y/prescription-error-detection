import { supabase } from "../../supabase/client";
import type { ProfileRow } from "../../supabase/types";
import type { Profile } from "../../types";

function mapRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    title: row.title,
    status: row.status,
    institution: row.institution ?? undefined,
    createdAt: row.created_at,
    institutionId: row.institution_id,
  };
}

/**
 * Every profile, for bulk identity resolution (prescriber/pharmacist/admin
 * names) across the app. Not filtered by status — historical attribution
 * must still resolve names for staff who have since been disabled.
 */
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw error;
  return (data ?? []).map(mapRow);
}
