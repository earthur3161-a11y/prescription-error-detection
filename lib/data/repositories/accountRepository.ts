import { supabase } from "../../supabase/client";
import type { SessionUser } from "../../auth/session-store";
import type { AccountRole } from "../../types";

/**
 * Authenticates against Supabase Auth, enforcing the expected portal role.
 * signInWithPassword establishes a real session before the role can be
 * checked (there's no way to gate sign-in itself on a custom claim), so a
 * role mismatch signs the session back out before returning null — RLS
 * still protects data regardless, but this avoids a wrong-role user
 * lingering with a valid session. Bad password, wrong role, and no-such
 * -account all return null identically: never reveal whether an account
 * exists.
 */
export async function authenticate(
  email: string,
  password: string,
  expectedRole: AccountRole
): Promise<SessionUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error || !data.session) return null;

  const role = data.session.user.app_metadata?.role as AccountRole | undefined;
  if (role !== expectedRole) {
    // Local scope: clears this browser's session immediately, without a
    // network round-trip that could fail and leave the momentarily
    // -established wrong-role session lingering.
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, title, status")
    .eq("id", data.session.user.id)
    .single();

  // Auth succeeded but there's no profile row, or the account has been
  // disabled — treat as not fully usable rather than returning a session
  // the rest of the app can't render (Topbar/Sidebar read name/title).
  if (!profile || profile.status === "disabled") {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  return {
    id: data.session.user.id,
    email: data.session.user.email ?? normalizedEmail,
    role,
    name: profile.name,
    title: profile.title,
    institutionId: (data.session.user.app_metadata?.institution_id as string | undefined) ?? null,
  };
}
