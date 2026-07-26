import { supabase } from "../../supabase/client";
import type { PrescriptionRow } from "../../supabase/types";
import type { DrugLineVerdict } from "../../screening-engine/types";
import type { Prescription, PrescriptionDrugLine, PrescriptionSource, PrescriptionStatus } from "../../types";

function mapRow(row: PrescriptionRow): Prescription {
  return {
    id: row.id,
    patientId: row.patient_id,
    prescriberId: row.prescriber_id,
    drugs: row.drugs as PrescriptionDrugLine[],
    verdicts: row.verdicts as DrugLineVerdict[],
    status: row.status,
    createdAt: row.created_at,
    pharmacistNote: row.pharmacist_note ?? undefined,
    adminNote: row.admin_note ?? undefined,
    source: row.source,
    externalPrescriberName: row.external_prescriber_name ?? undefined,
    patientCheckId: row.patient_check_id ?? undefined,
    institutionId: row.institution_id,
    originalPrescriptionId: row.original_prescription_id,
    versionNumber: row.version_number,
    supersededBy: row.superseded_by,
  };
}

export interface PrescriptionFilters {
  patientId?: string;
  prescriberId?: string;
  status?: PrescriptionStatus;
  source?: PrescriptionSource;
  /**
   * Excludes superseded (edited-away) versions — for "live" views: work
   * queues, browse/search lists, patient charts, dashboards. Deliberately
   * NOT the default: audit/compliance streams and reporting metrics
   * (useAuditEvents, useFacilityMetrics, the superadmin activity feed) need
   * every version, since each edit is a real screening event that happened
   * and override_logs/dispense_records must still resolve against exact
   * old versions by id. Filtering those would hide real history, not just
   * declutter a list — see 0016_prescription_versioning.sql's header.
   */
  currentOnly?: boolean;
}

export async function listPrescriptions(filters: PrescriptionFilters = {}): Promise<Prescription[]> {
  let query = supabase.from("prescriptions").select("*");
  if (filters.patientId) query = query.eq("patient_id", filters.patientId);
  if (filters.prescriberId) query = query.eq("prescriber_id", filters.prescriberId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.currentOnly) query = query.is("superseded_by", null);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function getPrescriptionById(id: string): Promise<Prescription | null> {
  const { data, error } = await supabase.from("prescriptions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

/**
 * Upsert rather than a pure insert so a retried submit (e.g. after a dropped
 * response) is safe to replay. institutionId must be the prescriber's own
 * JWT claim (null for an independent practitioner) — prescriptions_insert_own's
 * WITH CHECK (0012_institution_boundary.sql) rejects any other value.
 */
export async function createPrescription(prescription: Prescription): Promise<Prescription> {
  const { data, error } = await supabase
    .from("prescriptions")
    .upsert({
      id: prescription.id,
      patient_id: prescription.patientId,
      prescriber_id: prescription.prescriberId,
      drugs: prescription.drugs,
      verdicts: prescription.verdicts,
      status: prescription.status,
      created_at: prescription.createdAt,
      pharmacist_note: prescription.pharmacistNote ?? null,
      admin_note: prescription.adminNote ?? null,
      source: prescription.source,
      external_prescriber_name: prescription.externalPrescriberName ?? null,
      patient_check_id: prescription.patientCheckId ?? null,
      institution_id: prescription.institutionId ?? null,
      version_number: prescription.versionNumber,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error("Failed to save prescription.");
  return mapRow(data);
}

/**
 * Creates a new version of an existing prescription — an edit, never an
 * in-place overwrite. `drugs`/`verdicts` must be freshly computed by the
 * caller (screenDrugLine against the new drug list), the same way
 * createPrescription already trusts client-computed verdicts at creation
 * time; this function doesn't recompute them itself. Delegates the actual
 * two-row write (insert the new version, mark the old one superseded) to
 * create_prescription_version() so it's atomic — see 0016's header for why
 * this couldn't be two separate calls from here.
 */
export async function createPrescriptionVersion(
  editingId: string,
  newId: string,
  drugs: PrescriptionDrugLine[],
  verdicts: DrugLineVerdict[],
  status: PrescriptionStatus = "submitted"
): Promise<Prescription> {
  const { data, error } = await supabase.rpc("create_prescription_version", {
    p_editing_id: editingId,
    p_new_id: newId,
    p_drugs: drugs,
    p_verdicts: verdicts,
    p_status: status,
  });
  if (error || !data) throw error ?? new Error("Failed to create a new prescription version.");
  return mapRow(data);
}

export async function updatePrescriptionStatus(
  id: string,
  status: PrescriptionStatus,
  pharmacistNote?: string,
  adminNote?: string
): Promise<void> {
  const { data, error } = await supabase
    .from("prescriptions")
    .update({
      status,
      ...(pharmacistNote !== undefined ? { pharmacist_note: pharmacistNote } : {}),
      ...(adminNote !== undefined ? { admin_note: adminNote } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  // PostgREST returns success with an empty array (not an error) when RLS
  // silently filters out the row — surface that as a real failure instead of
  // letting a caller believe the status change actually happened.
  if (!data || data.length === 0) throw new Error("Prescription status update didn't apply — no matching row.");
}

/** Attach/replace the pharmacist's free-text note without changing status. */
export async function updatePharmacistNote(id: string, pharmacistNote: string): Promise<void> {
  const { data, error } = await supabase
    .from("prescriptions")
    .update({ pharmacist_note: pharmacistNote })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Pharmacist note update didn't apply — no matching row.");
}
