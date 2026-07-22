"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listSuperadminAccounts,
  listSuperadminSelfCheckAccounts,
  listSuperadminSubscriptions,
} from "../../data/repositories/superadminRepository";
import { buildSuperadminAccounts } from "../../superadmin/accounts";

/** Superadmin-only — RLS/RPC-gated, see 0009_superadmin_oversight.sql. */
export function useSuperAdminAccounts() {
  const staff = useQuery({ queryKey: ["superadmin", "accounts", "staff"], queryFn: listSuperadminAccounts });
  const patients = useQuery({
    queryKey: ["superadmin", "accounts", "patients"],
    queryFn: listSuperadminSelfCheckAccounts,
  });
  const subscriptions = useQuery({
    queryKey: ["superadmin", "accounts", "subscriptions"],
    queryFn: listSuperadminSubscriptions,
  });

  const isLoading = staff.isLoading || patients.isLoading || subscriptions.isLoading;
  const error = staff.error ?? patients.error ?? subscriptions.error;

  const accounts = useMemo(
    () =>
      buildSuperadminAccounts({
        staff: staff.data ?? [],
        selfCheckAccounts: patients.data ?? [],
        subscriptions: subscriptions.data ?? [],
      }),
    [staff.data, patients.data, subscriptions.data]
  );

  return { accounts, isLoading, error };
}
