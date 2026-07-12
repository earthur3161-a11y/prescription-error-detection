// Hand-written types for the Supabase schema (profiles, access_requests,
// check_access_request_status from Phase 1; patients, prescriptions,
// override_logs, patient_checks and their RPCs from Phase 2; self_check_accounts,
// check_payments and their RPCs from Phase 3). Mirrors
// supabase/migrations/0001_phase1_auth.sql, 0002_phase2_clinical_data.sql, and
// 0003_self_check_quota.sql exactly — update all four together. If the
// Supabase CLI is ever linked to the project, `supabase gen types typescript`
// can regenerate/replace this file directly.
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

export type PatientSex = "male" | "female" | "other";
export type RenalHepaticStatus = "normal" | "impaired" | "unknown";

export type PatientRow = {
  id: string;
  name: string;
  dob: string;
  sex: PatientSex;
  phone: string | null;
  weight_kg: number | null;
  renal_status: RenalHepaticStatus;
  hepatic_status: RenalHepaticStatus;
  // null = "not on file", [] = confirmed none. See the SQL comment on this
  // column — never give it a default.
  allergies: unknown | null;
  active_medications: unknown | null;
  is_pregnant: boolean | null;
  created_at: string;
};

export type PrescriptionStatusDb =
  | "draft"
  | "pending_admin_review"
  | "pending_admin_cosign"
  | "submitted"
  | "under_review"
  | "held"
  | "cleared"
  | "rejected"
  | "verified"
  | "dispensed"
  | "flagged";
export type PrescriptionSourceDb = "hospital" | "patient_submitted" | "walk_in";

export type PrescriptionRow = {
  id: string;
  patient_id: string;
  prescriber_id: string;
  drugs: unknown;
  verdicts: unknown;
  status: PrescriptionStatusDb;
  created_at: string;
  pharmacist_note: string | null;
  admin_note: string | null;
  source: PrescriptionSourceDb;
  external_prescriber_name: string | null;
  patient_check_id: string | null;
};

export type OverrideLogRow = {
  id: string;
  prescription_id: string;
  drug_id: string;
  verdict_overridden: "caution" | "blocked";
  reason_code: "benefit_outweighs_risk" | "verified_with_pharmacist" | "patient_tolerates_combination" | "other";
  reason_text: string;
  user_id: string;
  timestamp: string;
};

export type PatientCheckRow = {
  id: string;
  created_at: string;
  drugs: unknown;
  profile: unknown;
  verdicts: unknown;
  share_token: string;
  pulled_into_prescription_id: string | null;
  // Support/compliance traceability only — NOT the quota/payment
  // enforcement mechanism, which lives entirely in
  // create_patient_check_with_quota. See 0003_self_check_quota.sql.
  phone: string | null;
  // Idempotency key: lets a retried create_patient_check_with_quota call
  // for the same attempt replay the existing check instead of consuming a
  // second free/paid credit.
  client_request_id: string | null;
};

export type PatientCheckRpcRow = PatientCheckRow;

export type CheckPaymentStatus = "pending" | "success" | "failed";

export type SelfCheckAccountRow = {
  id: string;
  phone: string;
  phone_verified: boolean;
  otp_send_count: number;
  otp_last_sent_at: string | null;
  free_checks_used: number;
  created_at: string;
};

export type CheckPaymentRow = {
  id: string;
  phone: string;
  amount_pesewas: number;
  provider: string;
  provider_reference: string;
  status: CheckPaymentStatus;
  consumed: boolean;
  created_at: string;
  verified_at: string | null;
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
      patients: {
        Row: PatientRow;
        Insert: Partial<PatientRow> & Pick<PatientRow, "id" | "name" | "dob" | "sex" | "renal_status" | "hepatic_status">;
        Update: Partial<PatientRow>;
        Relationships: [];
      };
      prescriptions: {
        Row: PrescriptionRow;
        Insert: Partial<PrescriptionRow> &
          Pick<PrescriptionRow, "id" | "patient_id" | "prescriber_id" | "drugs" | "verdicts" | "status" | "created_at" | "source">;
        Update: Partial<PrescriptionRow>;
        Relationships: [];
      };
      override_logs: {
        Row: OverrideLogRow;
        Insert: Partial<OverrideLogRow> &
          Pick<OverrideLogRow, "id" | "prescription_id" | "drug_id" | "verdict_overridden" | "reason_code" | "reason_text" | "user_id" | "timestamp">;
        Update: Partial<OverrideLogRow>;
        Relationships: [];
      };
      patient_checks: {
        Row: PatientCheckRow;
        Insert: Partial<PatientCheckRow> &
          Pick<PatientCheckRow, "id" | "created_at" | "drugs" | "profile" | "verdicts" | "share_token">;
        Update: Partial<PatientCheckRow>;
        Relationships: [];
      };
      self_check_accounts: {
        Row: SelfCheckAccountRow;
        Insert: Partial<SelfCheckAccountRow> & Pick<SelfCheckAccountRow, "phone">;
        Update: Partial<SelfCheckAccountRow>;
        Relationships: [];
      };
      check_payments: {
        Row: CheckPaymentRow;
        Insert: Partial<CheckPaymentRow> &
          Pick<CheckPaymentRow, "phone" | "amount_pesewas" | "provider_reference">;
        Update: Partial<CheckPaymentRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_access_request_status: {
        Args: { p_email: string };
        Returns: { status: AccessRequestStatus; rejection_reason: string | null }[];
      };
      get_patient_check_by_id: {
        Args: { p_id: string };
        Returns: PatientCheckRpcRow[];
      };
      get_patient_check_by_share_token: {
        Args: { p_token: string };
        Returns: PatientCheckRpcRow[];
      };
      get_check_quota: {
        Args: { p_phone: string };
        Returns: { free_remaining: number; paid_available: number; phone_verified: boolean }[];
      };
      create_patient_check_with_quota: {
        Args: {
          p_phone: string;
          p_drugs: unknown;
          p_profile: unknown;
          p_verdicts: unknown;
          p_client_request_id: string | null;
        };
        Returns: {
          allowed: boolean;
          reason: string | null;
          check_id: string | null;
          created_at: string | null;
          share_token: string | null;
          free_remaining: number;
          paid_available: number;
        }[];
      };
      get_payment_status: {
        Args: { p_reference: string };
        Returns: { status: CheckPaymentStatus }[];
      };
    };
  };
};
