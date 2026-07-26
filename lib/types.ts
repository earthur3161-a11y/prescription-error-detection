// Core domain model shared across the app, data layer, and screening engine.

import type { DrugLineVerdict, Flag, Verdict } from "./screening-engine/types";

export type Route = "oral" | "IV" | "IM" | "topical" | "inhaled" | "rectal" | "sublingual" | "subcutaneous";

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
  /** Reaction specific to this cross-reactive class; falls back to the parent rule's `reaction` when omitted. */
  reaction?: string;
}

export interface AllergyRule {
  id: string;
  allergen: string;
  related_drug_classes: string[];
  severity: InteractionSeverity;
  /** Concrete description of the reaction this allergy class can cause, shown to the patient in place of a generic "could cause a reaction." */
  reaction: string;
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
  /**
   * True only for the Patient Self-Check synthetic patient when the age field
   * was left blank — every real patient record has a confirmed `dob` from the
   * required date input on patient creation and never sets this. When true,
   * age-dependent checks (pediatric/geriatric) must flag age as unknown
   * rather than deriving a (necessarily wrong) age from `dob`.
   */
  ageYearsUnknown?: boolean;
  /** Patient-reported reason(s) for this prescription, from the curated PATIENT_CONDITIONS list. Drives the indication-mismatch check; empty = not reported, never treated as "no condition." */
  reportedConditions?: string[];
  /** The account this patient record belongs to (RLS-enforced ownership) — undefined only on not-yet-persisted seed/template objects, never on a real DB row. */
  ownerId?: string;
  /** Undefined/null = independent practitioner's patient (owner-scoped only). Real value = institutional, scoped to that institution's own staff too. Never client-chosen — always the creator's own JWT claim, enforced by RLS. */
  institutionId?: string | null;
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
  institutionId?: string | null;
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
  | "submitted" // arrived at the pharmacy queue — shown as "New"
  | "under_review" // a pharmacist has opened it in Review
  | "held" // paused pending info / clarification / stock
  | "cleared" // approved by pharmacist, ready to dispense
  | "rejected" // stopped entirely by pharmacist
  | "verified"
  | "dispensed"
  | "flagged"
  | "cancelled"; // cancel is always a status flag, never a hard delete/overwrite

/** Statuses a prescription can be edited from — matches create_prescription_version()'s
 *  own check (0016_prescription_versioning.sql) exactly; keep both in sync.
 *  Deliberately excludes cleared/verified/dispensed: those represent a
 *  completed clinical decision, so a correction after that point is a new
 *  prescription, not an edit to this one. */
export const EDITABLE_PRESCRIPTION_STATUSES: readonly PrescriptionStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "held",
  "flagged",
  "rejected",
];

/** How this prescription's drug-check request arrived. */
export type PrescriptionSource = "physician" | "patient_submitted" | "walk_in";

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
  /** Same convention as Patient.institutionId — set once at creation from the prescriber's own JWT claim, never client-chosen. */
  institutionId?: string | null;
  /** Null on the root version, otherwise the ROOT of this prescription's edit chain (see 0016_prescription_versioning.sql) — never the immediate predecessor. */
  originalPrescriptionId?: string | null;
  /** 1 on the root version, incrementing per edit. */
  versionNumber: number;
  /** Null = this is the current version. Set the instant a newer edit is created. */
  supersededBy?: string | null;
}

/**
 * Client-side mirror of create_prescription_version()'s own guard
 * (0016_prescription_versioning.sql) — NOT the real enforcement (RLS/the
 * RPC is), just a fast, friendly pre-check so a future edit affordance can
 * decide whether to even offer editing without a round trip. Keep in sync
 * with the RPC's checks by construction: both read EDITABLE_PRESCRIPTION_STATUSES.
 */
export function isPrescriptionEditable(prescription: Pick<Prescription, "status" | "supersededBy">): boolean {
  return (
    (prescription.supersededBy ?? null) === null &&
    EDITABLE_PRESCRIPTION_STATUSES.includes(prescription.status)
  );
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
  // null = not sure / prefers not to say (falls back to "not on file", never treated as "confirmed no"); true/false = confirmed.
  isPregnant: boolean | null;
  renalStatus: RenalHepaticStatus;
  hepaticStatus: RenalHepaticStatus;
  /** Reason(s) for this prescription, picked from the curated PATIENT_CONDITIONS list — drives the indication-mismatch check. */
  reportedConditions: string[];
  /** Free-text elaboration on the reason for the prescription. Shown to the patient/pharmacist for context only — never fed into automated screening. */
  complaintNote: string | null;
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
  isPregnant: boolean | null;
  renalStatus: RenalHepaticStatus;
  hepaticStatus: RenalHepaticStatus;
  reportedConditions: string[];
  complaintNote: string | null;
  updatedAt: string;
}

// --- Facility Admin API integration ---
// A Facility Admin has no internal MediGuard workflow of its own (that
// pipeline was removed) — the entire product is integrating MediGuard's
// screening into the institution's own prescribing/dispensing system via a
// real, per-institution API key. See lib/integration/screenService.ts.

export type EnforcementLevel = "advisory" | "enforced";
export type InstitutionStatus = "active" | "suspended";

export interface Institution {
  id: string;
  name: string;
  status: InstitutionStatus;
  enforcementLevel: EnforcementLevel;
  createdAt: string;
}

export type ApiKeyMode = "live" | "sandbox";

/** Never carries the raw key or its hash — see institution_api_keys_public in 0007_institutions_api.sql. */
export interface InstitutionApiKey {
  id: string;
  institutionId: string;
  mode: ApiKeyMode;
  keyPrefix: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
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
  /**
   * The screening result as re-checked, fresh, at the moment of dispense —
   * never a possibly-stale earlier pass. Written exclusively by the
   * dispense_drug() RPC (see supabase/migrations/0010), never client-supplied.
   */
  screeningVerdict: Verdict;
  screeningFlags: Flag[];
  screenedAt: string;
  /** Required (server-enforced, not just UI) whenever screeningVerdict is not "safe". */
  overrideNote?: string;
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
