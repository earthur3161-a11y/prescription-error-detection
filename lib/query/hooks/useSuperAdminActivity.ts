"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listSuperadminAccounts,
  listSuperadminApiKeyActivity,
  listSuperadminCheckPayments,
  listSuperadminDispenseActivity,
  listSuperadminInstitutions,
  listSuperadminOverrideActivity,
  listSuperadminPatientCheckActivity,
  listSuperadminPrescriptionActivity,
  listSuperadminSubscriptionPayments,
} from "../../data/repositories/superadminRepository";
import { listAccessRequests } from "../../data/repositories/accessRequestRepository";
import { buildSuperadminActivity } from "../../superadmin/activity";

/**
 * Superadmin-only — every source here is RLS/RPC-gated (see
 * 0009_superadmin_oversight.sql) and pre-stripped of clinical columns at the
 * database layer, not just filtered client-side.
 */
export function useSuperAdminActivity() {
  const accounts = useQuery({ queryKey: ["superadmin", "accounts", "staff"], queryFn: listSuperadminAccounts });
  const prescriptions = useQuery({
    queryKey: ["superadmin", "activity", "prescriptions"],
    queryFn: listSuperadminPrescriptionActivity,
  });
  const overrides = useQuery({
    queryKey: ["superadmin", "activity", "overrides"],
    queryFn: listSuperadminOverrideActivity,
  });
  const dispenses = useQuery({
    queryKey: ["superadmin", "activity", "dispenses"],
    queryFn: listSuperadminDispenseActivity,
  });
  const patientChecks = useQuery({
    queryKey: ["superadmin", "activity", "patientChecks"],
    queryFn: listSuperadminPatientCheckActivity,
  });
  const checkPayments = useQuery({
    queryKey: ["superadmin", "activity", "checkPayments"],
    queryFn: listSuperadminCheckPayments,
  });
  const subscriptionPayments = useQuery({
    queryKey: ["superadmin", "activity", "subscriptionPayments"],
    queryFn: listSuperadminSubscriptionPayments,
  });
  const accessRequests = useQuery({ queryKey: ["accessRequests"], queryFn: listAccessRequests });
  const institutions = useQuery({
    queryKey: ["superadmin", "activity", "institutions"],
    queryFn: listSuperadminInstitutions,
  });
  const apiKeys = useQuery({ queryKey: ["superadmin", "activity", "apiKeys"], queryFn: listSuperadminApiKeyActivity });

  const queries = [
    accounts,
    prescriptions,
    overrides,
    dispenses,
    patientChecks,
    checkPayments,
    subscriptionPayments,
    accessRequests,
    institutions,
    apiKeys,
  ];
  const isLoading = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.error)?.error;

  const events = useMemo(
    () =>
      buildSuperadminActivity({
        accounts: accounts.data ?? [],
        prescriptions: prescriptions.data ?? [],
        overrides: overrides.data ?? [],
        dispenses: dispenses.data ?? [],
        patientChecks: patientChecks.data ?? [],
        checkPayments: checkPayments.data ?? [],
        subscriptionPayments: subscriptionPayments.data ?? [],
        accessRequests: accessRequests.data ?? [],
        institutions: institutions.data ?? [],
        apiKeys: apiKeys.data ?? [],
      }),
    [
      accounts.data,
      prescriptions.data,
      overrides.data,
      dispenses.data,
      patientChecks.data,
      checkPayments.data,
      subscriptionPayments.data,
      accessRequests.data,
      institutions.data,
      apiKeys.data,
    ]
  );

  return { events, isLoading, error };
}
