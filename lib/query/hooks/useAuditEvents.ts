"use client";

import { useMemo } from "react";
import { useOverrideLogs } from "./useOverrideLogs";
import { usePrescriptions } from "./usePrescriptions";
import { usePatients } from "./usePatients";
import { useFormulary } from "./useFormulary";
import { usePatientChecks } from "./usePatientChecks";
import { useClinicalAlerts } from "./useClinicalAlerts";
import { useAllPharmacistActions } from "./usePharmacy";
import { useAllPipelineEvents } from "./usePipelineEvents";
import { useProfiles } from "./useProfiles";
import { buildAuditEvents } from "../../compliance/auditEvents";

/**
 * Aggregates every append-only safety store into one reverse-chronological
 * audit stream for the Compliance Center. All sources are read-only here — the
 * center observes the audit trail, it never mutates it.
 */
export function useAuditEvents(currentUserId?: string) {
  const overrideLogs = useOverrideLogs();
  const prescriptions = usePrescriptions();
  const patients = usePatients();
  const formulary = useFormulary();
  const patientChecks = usePatientChecks();
  const clinicalAlerts = useClinicalAlerts();
  const pharmacistActions = useAllPharmacistActions();
  const pipelineEvents = useAllPipelineEvents();
  const profiles = useProfiles();

  const isLoading =
    overrideLogs.isLoading ||
    prescriptions.isLoading ||
    patients.isLoading ||
    formulary.isLoading ||
    patientChecks.isLoading ||
    clinicalAlerts.isLoading ||
    pharmacistActions.isLoading ||
    pipelineEvents.isLoading ||
    profiles.isLoading;

  const events = useMemo(
    () =>
      buildAuditEvents(
        {
          prescriptions: prescriptions.data ?? [],
          patientChecks: patientChecks.data ?? [],
          overrideLogs: overrideLogs.data ?? [],
          pharmacistActions: pharmacistActions.data ?? [],
          clinicalAlerts: clinicalAlerts.data ?? [],
          pipelineEvents: pipelineEvents.data ?? [],
        },
        {
          patients: patients.data ?? [],
          drugs: formulary.data?.drugs ?? [],
          users: [...(profiles.data?.values() ?? [])],
          currentUserId,
        }
      ),
    [
      prescriptions.data,
      patientChecks.data,
      overrideLogs.data,
      pharmacistActions.data,
      clinicalAlerts.data,
      pipelineEvents.data,
      patients.data,
      formulary.data,
      profiles.data,
      currentUserId,
    ]
  );

  return { events, isLoading };
}
