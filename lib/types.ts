// Core domain model shared across the app, data layer, and screening engine.

import type { DrugLineVerdict, Verdict } from "./screening-engine/types";

export type Route = "oral" | "IV" | "IM" | "topical" | "inhaled" | "rectal" | "sublingual";

export interface PediatricDosing {
  mgPerKgPerDose: number;
  maxMgPerDose: number;
}

export interface StandardDoseRange {
  minMgPerDose: number;
  maxMgPerDose: number;
  maxMgPerDay: number;
  frequency: string;
  weightBased: boolean;
  pediatric?: PediatricDosing;
}

/** US-FDA-style pregnancy risk category. Illustrative demo data — not an authoritative source. */
export type PregnancyCategory = "A" | "B" | "C" | "D" | "X";

/** Organ-impairment dosing guidance: "caution" = adjust dose / monitor; "avoid" = avoid in significant impairment. */
export type OrganDoseGuidance = "caution" | "avoid";

export interface Drug {
  id: string;
  generic_name: string;
  brand_names: string[];
  class: string;
  standard_dose_range: StandardDoseRange;
  route: Route[];
  region_availability: string[];
  /** Pregnancy risk category, when known. Drives the structured pregnancy screening; undefined = not categorised (falls back to contraindication text). Illustrative demo data. */
  pregnancyCategory?: PregnancyCategory;
  /** Dosing guidance in renal impairment, when known. Illustrative demo data. */
  renalDoseGuidance?: OrganDoseGuidance;
  /** Dosing guidance in hepatic impairment, when known. Illustrative demo data. */
  hepaticDoseGuidance?: OrganDoseGuidance;
  /**
   * Whether this drug appears on the region's Essential Medicines List. This is
   * a FLAG on a comprehensive drug record — it is deliberately not the boundary
   * of the dataset (non-EML drugs are still present and searchable, just tagged).
   * Maps to the `is_on_eml` field in the Section 3 data model.
   */
  onEssentialMedicinesList: boolean;
  /** Suggested EML-listed alternative in the same therapeutic role, when this drug is not on the EML. (`eml_alternative_id` in the spec.) */
  emlAlternativeDrugId?: string;
  /** Plain contraindication notes shown in clinical detail; optional and free-text for now. */
  contraindications?: string[];
}

export type InteractionSeverity = "minor" | "moderate" | "major" | "severe";

export interface InteractionRule {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: InteractionSeverity;
  description: string;
  referenceSource?: string;
}

export interface CrossReactiveClass {
  class: string;
  severity: InteractionSeverity;
}

export interface AllergyRule {
  id: string;
  allergen: string;
  related_drug_classes: string[];
  severity: InteractionSeverity;
  cross_reactive_classes?: CrossReactiveClass[];
  referenceSource?: string;
}

export interface FormularyBundle {
  region: string;
  drugs: Drug[];
  interactionRules: InteractionRule[];
  allergyRules: AllergyRule[];
}

export type AllergySeverity = "mild" | "moderate" | "severe";

export interface AllergyRecord {
  allergen: string;
  severity: AllergySeverity;
  reaction?: string;
}

export interface ActiveMedication {
  drugId: string;
  startedAt: string;
}

export type RenalHepaticStatus = "normal" | "impaired" | "unknown";

export interface Patient {
  id: string;
  name: string;
  dob: string;
  sex: "male" | "female" | "other";
  /** Contact number — one of the pharmacy's patient-search keys. */
  phone?: string;
  weightKg: number | null;
  renalStatus: RenalHepaticStatus;
  hepaticStatus: RenalHepaticStatus;
  // null = "not on file" (must be treated as unknown, never as "confirmed none").
  // [] = confirmed, explicitly recorded as none.
  allergies: AllergyRecord[] | null;
  activeMedications: ActiveMedication[] | null;
  // null = not on file / not applicable; true/false = confirmed. Drives the pregnancy contraindication check.
  isPregnant?: boolean | null;
}

export type UserRole = "prescriber" | "pharmacist" | "admin";

/** Every account role, including the internal MediGuard operator role that provisions facility accounts. */
export type AccountRole = UserRole | "superadmin";

export interface User {
  id: string;
  name: string;
  role: UserRole;
  title: string;
}

/**
 * Mirrors a Supabase `profiles` row — the real, shared identity record for
 * every provisioned account (supersedes the old per-browser `seedUsers`
 * lookup table for name/title resolution across the app).
 */
export interface Profile {
  id: string;
  role: AccountRole;
  name: string;
  title: string;
  status: "active" | "disabled";
  institution?: string;
  createdAt: string;
}

export type AccountStatus =
  | "invited" // provisioned but the holder hasn't set a password yet
  | "active"
  | "disabled";

/**
 * A real, provisioned login account. There are no anonymous/demo shortcuts —
 * accounts are either dev-seeded (gated, never in a production build) or
 * created by a MediGuard Super Admin approving an access request.
 */
export interface Account {
  id: string;
  email: string; // stored lowercased
  /** Demo-grade one-way hash (see hashPassword). Empty while status is "invited". NOT production-grade. */
  passwordHash: string;
  role: AccountRole;
  name: string;
  title: string;
  status: AccountStatus;
  institution?: string;
  createdAt: string;
}

export type AccessRequestStatus = "pending" | "approved" | "rejected";

/** A request from someone without an account to be provisioned one, reviewed by a MediGuard Super Admin. */
export interface AccessRequest {
  id: string;
  fullName: string;
  requestedRole: UserRole;
  institution: string;
  /** Professional registration/license number — required for physician & pharmacy roles. */
  licenseNumber?: string;
  email: string; // lowercased
  phone: string;
  status: AccessRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  /** One-time token for the secure invite link issued on approval (simulates the invite email). */
  inviteToken?: string;
  provisionedAccountId?: string;
  rejectionReason?: string;
}

export interface PrescriptionDrugLine {
  id: string;
  drugId: string;
  form: string;
  strengthMg: number;
  route: Route;
  doseMg: number;
  frequencyPerDay: number;
  durationDays: number;
}

export type PrescriptionStatus =
  | "draft"
  | "pending_admin_review"
  | "pending_admin_cosign"
  | "submitted" // arrived at the pharmacy queue — shown as "New"
  | "under_review" // a pharmacist has opened it in Review
  | "held" // paused pending info / clarification / stock
  | "cleared" // approved by pharmacist, ready to dispense
  | "rejected" // stopped entirely by pharmacist
  | "verified"
  | "dispensed"
  | "flagged";

/** Where a prescription entered the pharmacist's queue from. */
export type PrescriptionSource = "hospital" | "patient_submitted" | "walk_in";

export interface Prescription {
  id: string;
  patientId: string;
  prescriberId: string;
  drugs: PrescriptionDrugLine[];
  verdicts: DrugLineVerdict[];
  status: PrescriptionStatus;
  createdAt: string;
  pharmacistNote?: string;
  /** Note left by a Facility Admin when sending a prescription back to the prescriber at the checkpoint. */
  adminNote?: string;
  source: PrescriptionSource;
  /** Set when a walk-in prescription didn't originate from a registered MediGuard prescriber. */
  externalPrescriberName?: string;
  /** Links back to the originating Patient Self-Check, when source is "patient_submitted". */
  patientCheckId?: string;
}

export type OverrideReasonCode =
  | "benefit_outweighs_risk"
  | "verified_with_pharmacist"
  | "patient_tolerates_combination"
  | "other";

export interface OverrideLog {
  id: string;
  prescriptionId: string;
  drugId: string;
  verdictOverridden: "caution" | "blocked";
  reasonCode: OverrideReasonCode;
  reasonText: string;
  userId: string;
  timestamp: string;
}

// --- Patient Self-Check ---

/** Snapshot of what an anonymous or registered patient told us about themselves for a check. */
export interface PatientCheckProfile {
  ageYears: number | null;
  weightKg: number | null;
  allergies: AllergyRecord[] | null;
  activeMedications: ActiveMedication[] | null;
}

export interface PatientCheck {
  id: string;
  createdAt: string;
  drugs: PrescriptionDrugLine[];
  profile: PatientCheckProfile;
  verdicts: DrugLineVerdict[];
  /** Opaque token used in the shareable link/QR so a pharmacist can pull this check up. */
  shareToken: string;
  /** Set once a pharmacist has pulled this check into a real Prescription for verification. */
  pulledIntoPrescriptionId?: string;
}

/** A patient flagging that a check result seemed wrong — feeds MediGuard's own quality review, not clinical governance. */
export interface PatientFeedbackReport {
  id: string;
  patientCheckId?: string;
  message: string;
  createdAt: string;
}

/** A patient's own saved profile, stored locally in their browser — reused across future checks. No account/login required. */
export interface PatientProfile {
  id: "local";
  ageYears: number | null;
  weightKg: number | null;
  allergies: AllergyRecord[] | null;
  activeMedications: ActiveMedication[] | null;
  updatedAt: string;
}

// --- Institution Integration (Goal 3.2) ---

export type InstitutionMode = "standalone" | "integrated";
export type EnforcementLevel = "advisory" | "enforced";

export interface IntegrationErrorLogEntry {
  id: string;
  timestamp: string;
  message: string;
}

export interface IntegrationConfig {
  id: "local";
  mode: InstitutionMode;
  enforcementLevel: EnforcementLevel;
  apiKeyLive: string;
  apiKeySandbox: string;
  webhookUrl: string | null;
  lastSyncAt: string | null;
  errorLogs: IntegrationErrorLogEntry[];
}

// --- Physician <-> Facility Admin screening checkpoint pipeline ---

/**
 * Institution-wide policy controlling the Facility Admin checkpoint. Every
 * doctor-authored prescription passes through this checkpoint before it can
 * reach the pharmacist queue — it is not an optional step the doctor can skip.
 */
export interface FacilityPolicy {
  id: "local";
  /** When true, any line resolving to "blocked" holds the prescription for Admin co-sign before it proceeds to the pharmacist queue. */
  requireAdminCosignOnBlocked: boolean;
}

export type ClinicalAlertStatus = "pending_cosign" | "acknowledged" | "cosigned" | "sent_back";

/**
 * Raised by the Facility Admin checkpoint whenever it re-screens a
 * doctor-authored prescription and finds risk — visible to both the
 * prescribing doctor and the Facility Admin dashboard, per the real-time
 * clinical alert requirement.
 */
export interface ClinicalAlert {
  id: string;
  prescriptionId: string;
  prescriberId: string;
  verdict: Verdict;
  requiresCosign: boolean;
  message: string;
  status: ClinicalAlertStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export type PipelineEventType =
  | "admin_checkpoint_cleared"
  | "admin_checkpoint_held_for_cosign"
  | "admin_cosigned"
  | "admin_sent_back";

/** Append-only trace of every step a prescription takes through the Admin checkpoint, alongside the existing override log. */
export interface PipelineEvent {
  id: string;
  prescriptionId: string;
  type: PipelineEventType;
  note?: string;
  userId?: string;
  timestamp: string;
}

export type OutboxItemType = "prescription" | "override_log";
export type OutboxItemStatus = "pending" | "synced";

export interface OutboxItem {
  id?: number;
  type: OutboxItemType;
  payloadId: string;
  status: OutboxItemStatus;
  createdAt: string;
}

// --- Independent pharmacy portal (counter workflow) ---

export type BatchStatus = "active" | "near_expiry" | "expired" | "recalled";

/** A received lot of a drug held in the pharmacy's own stock. */
export interface Batch {
  id: string;
  drugId: string;
  batchNumber: string;
  supplier: string;
  receivedDate: string;
  expiryDate: string;
  quantityRemaining: number;
  /** Stored status; the effective active/near_expiry/expired status is derived from dates + settings, "recalled" is set manually. */
  status: BatchStatus;
}

export interface DispenseRecord {
  id: string;
  prescriptionId: string;
  patientId: string;
  pharmacistId: string;
  batchId: string;
  drugId: string;
  drugName: string;
  quantityDispensed: number;
  dispensedAt: string;
  /** Required when the dispensed quantity differs from what was prescribed. */
  partialDispenseReason?: string;
}

export type PharmacistActionType =
  | "approve"
  | "dispense"
  | "reject"
  | "hold"
  | "request_clarification"
  | "record_intervention";

/** Immutable log of every pharmacist decision on a prescription (audit trail + daily report source). */
export interface PharmacistAction {
  id: string;
  prescriptionId: string;
  pharmacistId: string;
  action: PharmacistActionType;
  reason?: string;
  /** For request_clarification: which drug and the structured question. */
  clarificationDrugId?: string;
  /** For record_intervention: what the outcome was (e.g. "dose reduced", "substituted"). */
  interventionOutcome?: string;
  timestamp: string;
}

export type StockAdjustmentType = "addition" | "removal" | "correction" | "return";

export interface StockAdjustment {
  id: string;
  batchId: string;
  drugId: string;
  pharmacistId: string;
  adjustmentType: StockAdjustmentType;
  /** Signed delta applied to quantityRemaining (additions positive, removals negative). */
  quantity: number;
  reason: string;
  timestamp: string;
}

/** Pharmacy-wide inventory alerting configuration, with optional per-drug low-stock overrides. */
export interface PharmacySettings {
  id: "local";
  defaultLowStockThreshold: number;
  nearExpiryDays: number;
  perDrugLowStock: Record<string, number>;
}

// --- Screening engine types (re-exported here for convenience; canonical
// definitions live in lib/screening-engine/types.ts) ---
export type {
  Severity,
  Verdict,
  Flag,
  DrugLineVerdict,
  ScreeningInput,
} from "./screening-engine/types";
