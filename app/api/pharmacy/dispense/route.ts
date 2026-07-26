import { z } from "zod";
import { supabaseService } from "@/lib/supabase/serviceClient";
import { DEFAULT_REGION, getFormularyBundle } from "@/lib/formulary";
import { screenDrugLine } from "@/lib/screening-engine";
import { isGenuineOverrideNote } from "@/lib/pharmacy/overrideValidation";
import type { AllergyRecord, ActiveMedication, Patient, PrescriptionDrugLine } from "@/lib/types";
import type { PatientRow, PrescriptionRow } from "@/lib/supabase/types";

/**
 * POST /api/pharmacy/dispense
 *
 * The hard gate: a drug cannot be dispensed without a screening pass that
 * happened right here, right now, against the real screening engine and
 * fresh patient/prescription data — never a value the client supplies.
 * Flagged results (caution/blocked) require a genuine override note or the
 * request is rejected before touching the database.
 *
 * This route is the actual enforcement boundary, not the dispense_drug() RPC
 * it calls: that RPC is granted to `service_role` only (see migration 0010),
 * so a signed-in pharmacist's browser session cannot invoke it directly no
 * matter what verdict they might try to pass — the only path to a
 * dispense_records row is through this server code, which always re-screens
 * before writing anything.
 */

const requestSchema = z.object({
  prescriptionId: z.string().uuid(),
  lineId: z.string().min(1),
  batchId: z.string().uuid(),
  quantity: z.number().int().positive(),
  partialDispenseReason: z.string().optional(),
  overrideNote: z.string().optional(),
});

function mapPatientRow(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob,
    sex: row.sex,
    phone: row.phone ?? undefined,
    weightKg: row.weight_kg,
    renalStatus: row.renal_status,
    hepaticStatus: row.hepatic_status,
    allergies: row.allergies as AllergyRecord[] | null,
    activeMedications: row.active_medications as ActiveMedication[] | null,
    isPregnant: row.is_pregnant,
    ownerId: row.owner_id ?? undefined,
  };
}

function mapPrescriptionRow(row: PrescriptionRow): { patientId: string; drugs: PrescriptionDrugLine[] } {
  return { patientId: row.patient_id, drugs: row.drugs as PrescriptionDrugLine[] };
}

export async function POST(request: Request) {
  // --- Authenticate: real Supabase session, pharmacist role only. ---
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return Response.json({ error: "unauthorized", message: "Missing bearer token." }, { status: 401 });
  }
  const { data: callerData, error: callerError } = await supabaseService.auth.getUser(token);
  if (callerError || !callerData.user) {
    return Response.json({ error: "unauthorized", message: "Invalid or expired session." }, { status: 401 });
  }
  if (callerData.user.app_metadata?.role !== "pharmacist") {
    return Response.json({ error: "forbidden", message: "Pharmacist role required." }, { status: 403 });
  }
  const pharmacistId = callerData.user.id;

  // --- Parse & validate the request shape. ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_request", message: "Request failed validation.", issues: z.treeifyError(parsed.error) },
      { status: 422 }
    );
  }
  const { prescriptionId, lineId, batchId, quantity, partialDispenseReason, overrideNote } = parsed.data;

  // --- Fetch fresh prescription + patient (never trust client-supplied clinical data). ---
  const { data: rxRow, error: rxError } = await supabaseService
    .from("prescriptions")
    .select("*")
    .eq("id", prescriptionId)
    .maybeSingle();
  if (rxError || !rxRow) {
    return Response.json({ error: "not_found", message: "Prescription not found." }, { status: 404 });
  }
  const prescription = mapPrescriptionRow(rxRow);

  const line = prescription.drugs.find((l) => l.id === lineId);
  if (!line) {
    return Response.json({ error: "not_found", message: "Drug line not found on this prescription." }, { status: 404 });
  }

  const { data: patientRow, error: patientError } = await supabaseService
    .from("patients")
    .select("*")
    .eq("id", prescription.patientId)
    .maybeSingle();
  if (patientError || !patientRow) {
    return Response.json({ error: "not_found", message: "Patient not found." }, { status: 404 });
  }
  const patient = mapPatientRow(patientRow);

  // --- Re-screen, fresh, right now. This is the actual gate. ---
  const formulary = getFormularyBundle(DEFAULT_REGION);
  const drug = formulary.drugs.find((d) => d.id === line.drugId);
  if (!drug) {
    return Response.json({ error: "unknown_drug", message: `drugId '${line.drugId}' is not in the formulary.` }, { status: 422 });
  }
  const verdictResult = screenDrugLine({
    patient,
    drugLine: line,
    otherLines: prescription.drugs,
    formulary,
  });
  const screenedAt = new Date().toISOString();

  // --- For any flagged result, a genuine override note is mandatory. Server-enforced. ---
  if (verdictResult.verdict !== "safe" && !isGenuineOverrideNote(overrideNote)) {
    return Response.json(
      {
        error: "override_note_required",
        message: `This drug screened as "${verdictResult.verdict}". A specific, non-trivial override note is required before it can be dispensed.`,
        verdict: verdictResult.verdict,
        flags: verdictResult.flags,
      },
      { status: 422 }
    );
  }

  // --- Atomic write: stock check, decrement, and the immutable record, all in one RPC. ---
  const { data: record, error: dispenseError } = await supabaseService.rpc("dispense_drug", {
    p_prescription_id: prescriptionId,
    p_patient_id: prescription.patientId,
    p_pharmacist_id: pharmacistId,
    p_batch_id: batchId,
    p_drug_id: drug.id,
    p_drug_name: drug.generic_name,
    p_quantity: quantity,
    p_partial_dispense_reason: partialDispenseReason ?? null,
    p_screening_verdict: verdictResult.verdict,
    p_screening_flags: verdictResult.flags,
    p_screened_at: screenedAt,
    p_override_note: verdictResult.verdict === "safe" ? null : (overrideNote ?? null),
  });

  if (dispenseError || !record) {
    const message = dispenseError?.message ?? "Dispense failed.";
    const status = /insufficient stock/i.test(message)
      ? 409
      : /recalled/i.test(message)
        ? 409
        : /batch not found/i.test(message)
          ? 404
          : /override note is required/i.test(message)
            ? 422
            : 500;
    return Response.json({ error: "dispense_failed", message }, { status });
  }

  return Response.json(
    {
      id: record.id,
      prescriptionId: record.prescription_id,
      patientId: record.patient_id,
      pharmacistId: record.pharmacist_id,
      batchId: record.batch_id,
      drugId: record.drug_id,
      drugName: record.drug_name,
      quantityDispensed: record.quantity_dispensed,
      partialDispenseReason: record.partial_dispense_reason ?? undefined,
      screeningVerdict: record.screening_verdict,
      screeningFlags: record.screening_flags,
      screenedAt: record.screened_at,
      overrideNote: record.override_note ?? undefined,
      dispensedAt: record.dispensed_at,
    },
    { status: 200 }
  );
}
