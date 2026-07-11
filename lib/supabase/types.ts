// Hand-written types for the Phase 1 Supabase schema (profiles,
// access_requests, check_access_request_status). Mirrors
// supabase/migrations/0001_phase1_auth.sql exactly — update both together.
// If the Supabase CLI is ever linked to the project, `supabase gen types
// typescript` can regenerate/replace this file directly.
//
// Row/Insert/Update shapes are declared with `type`, not `interface`. This
// is required, not stylistic: @supabase/postgrest-js's GenericTable
// constrains Row/Insert/Update to `Record<string, unknown>`, and a plain
// `interface` — unlike an object-literal `type` alias — does not
// structurally satisfy an index-signature constraint in this generic
// -inference position. Using `interface` here silently makes every query
// resolve to `never` with no direct error at the declaration site (the
// error surfaces later, confusingly, wherever the query result is used).
// Verified empirically against the installed postgrest-js version.

export type ProfileRole = "prescriber" | "pharmacist" | "admin" | "superadmin";
export type ProfileStatus = "active" | "disabled";
export type AccessRequestRole = "prescriber" | "pharmacist" | "admin";
export type AccessRequestStatus = "pending" | "approved" | "rejected";

export type ProfileRow = {
  id: string;
  role: ProfileRole;
  name: string;
  title: string;
  status: ProfileStatus;
  institution: string | null;
  created_at: string;
};

export type AccessRequestRow = {
  id: string;
  full_name: string;
  requested_role: AccessRequestRole;
  institution: string;
  license_number: string | null;
  email: string;
  phone: string;
  status: AccessRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  provisioned_account_id: string | null;
  rejection_reason: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "id" | "role" | "name" | "title">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      access_requests: {
        Row: AccessRequestRow;
        Insert: Partial<AccessRequestRow> &
          Pick<AccessRequestRow, "full_name" | "requested_role" | "institution" | "email" | "phone">;
        Update: Partial<AccessRequestRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_access_request_status: {
        Args: { p_email: string };
        Returns: { status: AccessRequestStatus; rejection_reason: string | null }[];
      };
    };
  };
};
