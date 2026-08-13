// Hand-written types for the Supabase schema (profiles, access_requests,
// check_access_request_status from Phase 1; patients, prescriptions,
// override_logs, patient_checks and their RPCs from Phase 2; self_check_accounts,
// check_payments and their RPCs from Phase 3; superadmin oversight RPCs/views
// from Phase E). Mirrors supabase/migrations/0001_phase1_auth.sql through
// 0009_superadmin_oversight.sql exactly — update together. If the Supabase
// CLI is ever linked to the project, `supabase gen types typescript` can
// regenerate/replace this file directly.
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
  institution_id: string | null;
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
  // null/absent = no reason on file yet; [] would mean "confirmed no reason"
  // but the app never actually writes that — an empty selection and "not
  // asked" are the same "don't flag on indication" state to the engine (see
  // checkIndication's own early-return), so there's no observable difference
  // between the two at this column. Nullable at the DB level (existing rows
  // predate this column) — see patientRepository.ts.
  reported_conditions: unknown | null;
  created_at: string;
  // Nullable at the DB level (existing rows predate this column) but always
  // set by the app on every insert — see patientRepository.createPatient().
  owner_id: string | null;
  // null = independent practitioner (no institution); real value only ever
  // matches the creating user's own JWT institution_id claim, enforced by
  // patients_insert_own's WITH CHECK — see 0012_institution_boundary.sql.
  institution_id: string | null;
};

export type PrescriptionStatusDb =
  | "draft"
  | "submitted"
  | "under_review"
  | "held"
  | "cleared"
  | "rejected"
  | "verified"
  | "dispensed"
  | "flagged"
  | "cancelled";
export type PrescriptionSourceDb = "physician" | "patient_submitted" | "walk_in";

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
  // Same convention as patients.institution_id — see 0012_institution_boundary.sql.
  institution_id: string | null;
  // Versioning (0016_prescription_versioning.sql): null on the root version,
  // otherwise points at the ROOT of the chain (not the immediate
  // predecessor) — every version, one query, no recursion.
  original_prescription_id: string | null;
  version_number: number;
  // null = this is the current version. Set on the OLD row the instant a
  // new version is created via create_prescription_version().
  superseded_by: string | null;
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

export type PharmacistActionRow = {
  id: string;
  prescription_id: string;
  // For a prescriber_response row, this is the responding PRESCRIBER's user
  // id — the column name predates that row type. See 0030's own comment.
  pharmacist_id: string;
  action: "approve" | "dispense" | "reject" | "hold" | "request_clarification" | "record_intervention" | "prescriber_response";
  reason: string | null;
  clarification_drug_id: string | null;
  intervention_outcome: string | null;
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

/** Row shape of patient_feedback_reports (0024) — the "report an issue" flow's real, shared table. */
export type PatientFeedbackReportRow = {
  id: string;
  patient_check_id: string | null;
  message: string;
  created_at: string;
};

export type CheckPaymentStatus = "pending" | "success" | "failed";

export type SelfCheckAccountRow = {
  id: string;
  phone: string;
  phone_verified: boolean;
  otp_send_count: number;
  otp_last_sent_at: string | null;
  // sha256(phone + code); never the plaintext code. Cleared (null) once
  // consumed by a successful verify — see 0023_self_hosted_otp_codes.sql.
  otp_code_hash: string | null;
  otp_expires_at: string | null;
  otp_verify_attempts: number;
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

export type SubscriptionProduct = "physician_portal" | "pharmacy_portal";
export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

export type SubscriptionRow = {
  id: string;
  owner_id: string;
  product: SubscriptionProduct;
  status: SubscriptionStatus;
  period_end: string | null;
  provider: string;
  provider_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPaymentStatus = "pending" | "success" | "failed";

export type SubscriptionPaymentRow = {
  id: string;
  owner_id: string;
  product: SubscriptionProduct;
  amount_pesewas: number;
  period_days: number;
  provider: string;
  provider_reference: string;
  status: SubscriptionPaymentStatus;
  created_at: string;
  verified_at: string | null;
};

export type InstitutionStatus = "active" | "suspended";
export type EnforcementLevel = "advisory" | "enforced";

export type InstitutionRow = {
  id: string;
  name: string;
  status: InstitutionStatus;
  enforcement_level: EnforcementLevel;
  created_at: string;
  created_by: string | null;
};

export type ApiKeyMode = "live" | "sandbox";

/** The service-role-only base table row — includes key_hash. Never exposed to a client; see InstitutionApiKeyPublicRow. */
export type InstitutionApiKeyRow = {
  id: string;
  institution_id: string;
  mode: ApiKeyMode;
  key_prefix: string;
  key_hash: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  // Rate limiting (0018_institution_api_rate_limiting.sql) — internal
  // server state, never surfaced through institution_api_keys_public/
  // _superadmin (both use explicit column lists that predate these two).
  rate_window_start: string | null;
  rate_window_count: number;
};

/** Mirrors the institution_api_keys_public view — never carries key_hash. */
export type InstitutionApiKeyPublicRow = Omit<InstitutionApiKeyRow, "key_hash">;

/** Mirrors the institution_api_keys_superadmin view — same shape, scoped to the caller having the superadmin role instead of "my own institution". */
export type InstitutionApiKeySuperadminRow = Omit<InstitutionApiKeyRow, "key_hash">;

/** Row shape of get_superadmin_accounts() — profiles joined to auth.users.email, since profiles has no email column of its own. */
export type SuperadminAccountRow = {
  id: string;
  role: ProfileRole;
  name: string;
  title: string;
  status: ProfileStatus;
  institution: string | null;
  created_at: string;
  email: string | null;
};

/** Row shape of get_superadmin_prescription_activity() — administrative metadata only, no drugs/verdicts/notes. */
export type SuperadminPrescriptionActivityRow = {
  id: string;
  created_at: string;
  status: PrescriptionStatusDb;
  source: PrescriptionSourceDb;
  prescriber_id: string;
  prescriber_name: string;
  patient_id: string;
  patient_name: string;
};

/** Row shape of get_superadmin_override_activity() — that an override happened, not what it was. */
export type SuperadminOverrideActivityRow = {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  prescription_id: string;
};

/** Row shape of get_superadmin_dispense_activity() (0021) — no drug identity/verdict/flags/override note, same redaction reasoning as SuperadminOverrideActivityRow. */
export type SuperadminDispenseActivityRow = {
  id: string;
  dispensed_at: string;
  prescription_id: string;
  patient_id: string;
  patient_name: string;
  pharmacist_id: string;
  pharmacist_name: string;
  quantity_dispensed: number;
};

/** Row shape of get_superadmin_patient_check_activity() — no drugs/verdicts/profile. */
export type SuperadminPatientCheckActivityRow = {
  id: string;
  created_at: string;
  phone: string | null;
  pulled_into_prescription_id: string | null;
};

/** Row shape of custom_drugs (0026) — admin-added formulary entries, additive on top of the static Ghana base set. */
export type CustomDrugRow = {
  id: string;
  drug: unknown;
  owner_id: string;
  institution_id: string | null;
  created_at: string;
};

export type BatchStatusDb = "active" | "recalled";

export type BatchRow = {
  id: string;
  drug_id: string;
  batch_number: string;
  supplier: string;
  received_date: string;
  expiry_date: string;
  quantity_remaining: number;
  status: BatchStatusDb;
  created_at: string;
  // Institution boundary (0020_pharmacy_institution_boundary.sql) — same
  // owner_id/institution_id convention as patients: owner_id always set from
  // the creating pharmacist's own JWT, institution_id only for institutional
  // pharmacists. owner_id is null on pre-0020 rows (no pharmacist_id ever
  // existed to backfill it from).
  institution_id: string | null;
  owner_id: string | null;
};

export type ScreeningVerdictDb = "safe" | "caution" | "blocked";

export type DispenseRecordRow = {
  id: string;
  prescription_id: string;
  patient_id: string;
  pharmacist_id: string;
  batch_id: string;
  drug_id: string;
  drug_name: string;
  quantity_dispensed: number;
  partial_dispense_reason: string | null;
  screening_verdict: ScreeningVerdictDb;
  screening_flags: unknown;
  screened_at: string;
  override_note: string | null;
  dispensed_at: string;
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
        Insert: Partial<PatientRow> & Pick<PatientRow, "id" | "name" | "dob" | "sex" | "renal_status" | "hepatic_status" | "owner_id">;
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
      pharmacist_actions: {
        Row: PharmacistActionRow;
        Insert: Partial<PharmacistActionRow> & Pick<PharmacistActionRow, "id" | "prescription_id" | "pharmacist_id" | "action" | "timestamp">;
        Update: Partial<PharmacistActionRow>;
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
      patient_feedback_reports: {
        Row: PatientFeedbackReportRow;
        Insert: Partial<PatientFeedbackReportRow> & Pick<PatientFeedbackReportRow, "message">;
        Update: Partial<PatientFeedbackReportRow>;
        Relationships: [];
      };
      check_payments: {
        Row: CheckPaymentRow;
        Insert: Partial<CheckPaymentRow> &
          Pick<CheckPaymentRow, "phone" | "amount_pesewas" | "provider_reference">;
        Update: Partial<CheckPaymentRow>;
        Relationships: [];
      };
      subscriptions: {
        Row: SubscriptionRow;
        Insert: Partial<SubscriptionRow> & Pick<SubscriptionRow, "owner_id" | "product">;
        Update: Partial<SubscriptionRow>;
        Relationships: [];
      };
      subscription_payments: {
        Row: SubscriptionPaymentRow;
        Insert: Partial<SubscriptionPaymentRow> &
          Pick<SubscriptionPaymentRow, "owner_id" | "product" | "amount_pesewas" | "provider_reference">;
        Update: Partial<SubscriptionPaymentRow>;
        Relationships: [];
      };
      institutions: {
        Row: InstitutionRow;
        Insert: Partial<InstitutionRow> & Pick<InstitutionRow, "name">;
        Update: Partial<InstitutionRow>;
        Relationships: [];
      };
      institution_api_keys: {
        Row: InstitutionApiKeyRow;
        Insert: Partial<InstitutionApiKeyRow> &
          Pick<InstitutionApiKeyRow, "institution_id" | "mode" | "key_prefix" | "key_hash">;
        Update: Partial<InstitutionApiKeyRow>;
        Relationships: [];
      };
      institution_api_keys_public: {
        Row: InstitutionApiKeyPublicRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      institution_api_keys_superadmin: {
        Row: InstitutionApiKeySuperadminRow;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      custom_drugs: {
        Row: CustomDrugRow;
        Insert: Partial<CustomDrugRow> & Pick<CustomDrugRow, "id" | "drug" | "owner_id">;
        Update: Partial<CustomDrugRow>;
        Relationships: [];
      };
      batches: {
        Row: BatchRow;
        Insert: Partial<BatchRow> &
          Pick<
            BatchRow,
            "drug_id" | "batch_number" | "supplier" | "received_date" | "expiry_date" | "quantity_remaining"
          >;
        Update: Partial<BatchRow>;
        Relationships: [];
      };
      dispense_records: {
        // Insert/Update are `never` at the type level too: the only writer is
        // the dispense_drug() RPC (service_role only), not a direct table
        // insert — see the migration's header comment for why.
        Row: DispenseRecordRow;
        Insert: never;
        Update: never;
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
      create_patient_feedback_report: {
        Args: { p_patient_check_id: string | null; p_message: string };
        Returns: PatientFeedbackReportRow;
      };
      get_my_subscription_status: {
        Args: Record<string, never>;
        Returns: {
          product: SubscriptionProduct;
          status: SubscriptionStatus;
          period_end: string | null;
          days_remaining: number;
          /** status = 'active' AND period_end > now(), computed server-side — the one signal callers should actually gate on, not the raw status column alone (0022_restore_subscription_enforcement.sql). */
          is_active: boolean;
        }[];
      };
      update_my_institution_enforcement_level: {
        Args: { p_level: string };
        Returns: undefined;
      };
      get_superadmin_accounts: {
        Args: Record<string, never>;
        Returns: SuperadminAccountRow[];
      };
      get_superadmin_prescription_activity: {
        Args: Record<string, never>;
        Returns: SuperadminPrescriptionActivityRow[];
      };
      get_superadmin_override_activity: {
        Args: Record<string, never>;
        Returns: SuperadminOverrideActivityRow[];
      };
      get_superadmin_dispense_activity: {
        Args: Record<string, never>;
        Returns: SuperadminDispenseActivityRow[];
      };
      get_superadmin_patient_check_activity: {
        Args: Record<string, never>;
        Returns: SuperadminPatientCheckActivityRow[];
      };
      // service_role only — see 0010's header comment. Not callable from the
      // browser client, included here only for typing supabaseService calls.
      dispense_drug: {
        Args: {
          p_prescription_id: string;
          p_patient_id: string;
          p_pharmacist_id: string;
          p_batch_id: string;
          p_drug_id: string;
          p_drug_name: string;
          p_quantity: number;
          p_partial_dispense_reason: string | null;
          p_screening_verdict: ScreeningVerdictDb;
          p_screening_flags: unknown;
          p_screened_at: string;
          p_override_note: string | null;
          p_caller_institution_id: string | null;
        };
        Returns: DispenseRecordRow;
      };
      // authenticated-callable, security invoker — see 0016's header comment
      // for why this differs from dispense_drug's service_role-only grant.
      create_prescription_version: {
        Args: {
          p_editing_id: string;
          p_new_id: string;
          p_drugs: unknown;
          p_verdicts: unknown;
          p_status: PrescriptionStatusDb;
        };
        Returns: PrescriptionRow;
      };
      // service_role only — see 0018's header comment. Not callable from the
      // browser client, included here only for typing supabaseService calls.
      check_and_increment_api_rate_limit: {
        Args: {
          p_key_id: string;
          p_limit: number;
          p_window_seconds?: number;
        };
        Returns: {
          allowed: boolean;
          retry_after_seconds: number;
          window_reset_at: string;
        }[];
      };
      // Reporting module (0019) — institution/self-scoped inside the function
      // body from the caller's own JWT claims, not a trusted parameter.
      get_reporting_summary: {
        Args: { p_from?: string; p_to?: string };
        Returns: {
          total_prescriptions: number;
          total_lines: number;
          safe_lines: number;
          caution_lines: number;
          blocked_lines: number;
          override_count: number;
        }[];
      };
      get_reporting_daily_trend: {
        Args: { p_from?: string; p_to?: string };
        Returns: {
          day: string;
          safe_count: number;
          caution_count: number;
          blocked_count: number;
        }[];
      };
      get_reporting_drug_usage: {
        Args: { p_from?: string; p_to?: string };
        Returns: {
          drug_id: string;
          times_prescribed: number;
          flagged_count: number;
        }[];
      };
      get_reporting_flag_types: {
        Args: { p_from?: string; p_to?: string };
        Returns: { flag_type: string; count: number }[];
      };
      get_reporting_prescriber_performance: {
        Args: { p_from?: string; p_to?: string };
        Returns: {
          prescriber_id: string;
          prescriber_name: string;
          total_lines: number;
          flagged_lines: number;
          override_count: number;
        }[];
      };
    };
  };
};
