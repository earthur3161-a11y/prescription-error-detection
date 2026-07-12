import { supabase } from "../../supabase/client";
import type { PatientCheckRow } from "../../supabase/types";
import type { DrugLineVerdict } from "../../screening-engine/types";
import type { PatientCheck, PatientCheckProfile, PrescriptionDrugLine } from "../../types";

const DEVICE_CHECK_IDS_KEY = "mediguard-device-check-ids";

function getDeviceCheckIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DEVICE_CHECK_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function rememberDeviceCheckId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getDeviceCheckIds();
    if (!ids.includes(id)) {
      window.localStorage.setItem(DEVICE_CHECK_IDS_KEY, JSON.stringify([id, ...ids]));
    }
  } catch {
    /* ignore — worst case, this device's history tab is missing an entry */
  }
}

function mapRow(row: PatientCheckRow): PatientCheck {
  return {
    id: row.id,
    createdAt: row.created_at,
    drugs: row.drugs as PrescriptionDrugLine[],
    profile: row.profile as PatientCheckProfile,
    verdicts: row.verdicts as DrugLineVerdict[],
    shareToken: row.share_token,
    pulledIntoPrescriptionId: row.pulled_into_prescription_id ?? undefined,
  };
}

export type CreateCheckResult =
  | { allowed: true; check: PatientCheck }
  | { allowed: false; reason: "not_verified" | "no_credit"; freeRemaining: number; paidAvailable: number };

/**
 * The only way an anonymous caller creates a patient_checks row —
 * patient_checks_insert_any was dropped in 0003_self_check_quota.sql, so
 * create_patient_check_with_quota (phone-verification + free/paid quota +
 * the insert, all in one transaction) is the only path in. Records the new
 * check's id in this device's local history list on success (read by
 * listPatientChecksForDevice).
 */
export async function createPatientCheckWithQuota(params: {
  phone: string;
  drugs: PrescriptionDrugLine[];
  profile: PatientCheckProfile;
  verdicts: DrugLineVerdict[];
  clientRequestId: string;
}): Promise<CreateCheckResult> {
  const { data, error } = await supabase.rpc("create_patient_check_with_quota", {
    p_phone: params.phone,
    p_drugs: params.drugs,
    p_profile: params.profile,
    p_verdicts: params.verdicts,
    p_client_request_id: params.clientRequestId,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row || !row.allowed || !row.check_id || !row.created_at || !row.share_token) {
    return {
      allowed: false,
      reason: (row?.reason as "not_verified" | "no_credit") ?? "no_credit",
      freeRemaining: row?.free_remaining ?? 0,
      paidAvailable: row?.paid_available ?? 0,
    };
  }

  const check: PatientCheck = {
    id: row.check_id,
    createdAt: row.created_at,
    drugs: params.drugs,
    profile: params.profile,
    verdicts: params.verdicts,
    shareToken: row.share_token,
  };
  rememberDeviceCheckId(check.id);
  return { allowed: true, check };
}

/**
 * There is no anon SELECT policy on patient_checks — this goes through a
 * narrow SECURITY DEFINER RPC instead, so an anonymous caller can only ever
 * read the one row whose exact id they already hold, never browse the table.
 */
export async function getPatientCheckById(id: string): Promise<PatientCheck | null> {
  const { data, error } = await supabase.rpc("get_patient_check_by_id", { p_id: id });
  if (error) throw error;
  const row = data?.[0];
  return row ? mapRow(row) : null;
}

/** Same narrow-RPC reasoning as getPatientCheckById, keyed by the share link's token instead. */
export async function getPatientCheckByShareToken(shareToken: string): Promise<PatientCheck | null> {
  const { data, error } = await supabase.rpc("get_patient_check_by_share_token", { p_token: shareToken });
  if (error) throw error;
  const row = data?.[0];
  return row ? mapRow(row) : null;
}

/** Broad, authenticated-only read of every check — the compliance center and the audit event feed. */
export async function listPatientChecks(): Promise<PatientCheck[]> {
  const { data, error } = await supabase
    .from("patient_checks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

/**
 * Device-scoped history for the anonymous /check/history page: this device's
 * own list of check ids (localStorage), each resolved through the same
 * narrow anonymous RPC used everywhere else — never a table scan.
 */
export async function listPatientChecksForDevice(): Promise<PatientCheck[]> {
  const ids = getDeviceCheckIds();
  const results = await Promise.all(ids.map((id) => getPatientCheckById(id)));
  return results
    .filter((c): c is PatientCheck => !!c)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markPatientCheckPulled(id: string, prescriptionId: string): Promise<void> {
  const { data, error } = await supabase
    .from("patient_checks")
    .update({ pulled_into_prescription_id: prescriptionId })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Marking the patient check as pulled didn't apply — no matching row.");
}
