import { DEFAULT_REGION, getFormularyBundle } from "../formulary";
import { overallVerdict, screenDrugLine } from "../screening-engine";
import { getPatientById } from "../data/repositories/patientRepository";
import { createPrescription } from "../data/repositories/prescriptionRepository";
import { getFacilityPolicy } from "../data/repositories/facilityPolicyRepository";
import { createClinicalAlert } from "../data/repositories/clinicalAlertRepository";
import { appendPipelineEvent } from "../data/repositories/pipelineEventRepository";
import type { Prescription } from "../types";

/**
 * The structural checkpoint every doctor-authored ("hospital" source)
 * prescription must pass through before it can reach the pharmacist queue —
 * there is no code path from PrescriptionBuilder straight to a "submitted"
 * status for this source. Re-runs the same screenDrugLine engine the doctor
 * already saw client-side, so the stored verdict is always the checkpoint's
 * own computation rather than trusting whatever the client sent.
 */
export async function runAdminCheckpoint(prescription: Prescription): Promise<Prescription> {
  const formulary = getFormularyBundle(DEFAULT_REGION);
  const patient = await getPatientById(prescription.patientId);

  const verdicts = prescription.drugs.map((line) =>
    screenDrugLine({ patient, drugLine: line, otherLines: prescription.drugs, formulary })
  );
  const overall = overallVerdict(verdicts);
  const hasBlocked = verdicts.some((v) => v.verdict === "blocked");
  const policy = await getFacilityPolicy();
  const holdForCosign = hasBlocked && policy.requireAdminCosignOnBlocked;

  const updated: Prescription = {
    ...prescription,
    verdicts,
    status: holdForCosign ? "pending_admin_cosign" : "submitted",
  };
  await createPrescription(updated);

  await appendPipelineEvent({
    prescriptionId: prescription.id,
    type: holdForCosign ? "admin_checkpoint_held_for_cosign" : "admin_checkpoint_cleared",
    note: `Checkpoint re-screen resolved to ${overall}.`,
  });

  if (overall !== "safe") {
    await createClinicalAlert({
      prescriptionId: prescription.id,
      prescriberId: prescription.prescriberId,
      verdict: overall,
      requiresCosign: holdForCosign,
      status: holdForCosign ? "pending_cosign" : "acknowledged",
      message: holdForCosign
        ? "A blocked risk was confirmed at the Facility Admin checkpoint — held for co-sign before it can reach the pharmacy."
        : `A ${overall} risk was confirmed at the Facility Admin checkpoint. Your logged override was recorded and this is now visible to the Facility Admin.`,
    });
  }

  return updated;
}
