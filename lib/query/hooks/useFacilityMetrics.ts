"use client";

import { useMemo } from "react";
import { useOverrideLogs } from "./useOverrideLogs";
import { usePrescriptions } from "./usePrescriptions";
import { useFormulary } from "./useFormulary";
import { usePatientChecks } from "./usePatientChecks";
import { useClinicalAlerts } from "./useClinicalAlerts";
import { useAllPharmacistActions } from "./usePharmacy";
import { buildFacilityMetrics } from "../../analytics/facilityMetrics";

/** Reads the append-only stores and derives facility analytics. Read-only — analytics never mutates the trail. */
export function useFacilityMetrics() {
  const prescriptions = usePrescriptions();
  const patientChecks = usePatientChecks();
  const overrideLogs = useOverrideLogs();
  const pharmacistActions = useAllPharmacistActions();
  const clinicalAlerts = useClinicalAlerts();
  const formulary = useFormulary();

  const isLoading =
    prescriptions.isLoading ||
    patientChecks.isLoading ||
    overrideLogs.isLoading ||
    pharmacistActions.isLoading ||
    clinicalAlerts.isLoading ||
    formulary.isLoading;

  const metrics = useMemo(
    () =>
      buildFacilityMetrics(
        {
          prescriptions: prescriptions.data ?? [],
          patientChecks: patientChecks.data ?? [],
          overrideLogs: overrideLogs.data ?? [],
          pharmacistActions: pharmacistActions.data ?? [],
          clinicalAlerts: clinicalAlerts.data ?? [],
        },
        formulary.data?.drugs ?? []
      ),
    [
      prescriptions.data,
      patientChecks.data,
      overrideLogs.data,
      pharmacistActions.data,
      clinicalAlerts.data,
      formulary.data,
    ]
  );

  return { metrics, isLoading };
}
