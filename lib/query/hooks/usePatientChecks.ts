"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPatientCheckWithQuota,
  getPatientCheckById,
  getPatientCheckByShareToken,
  listPatientChecks,
  listPatientChecksForDevice,
  markPatientCheckPulled,
} from "../../data/repositories/patientCheckRepository";
import type { PatientCheck } from "../../types";

export function useCreatePatientCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPatientCheckWithQuota,
    // The RPC already recomputes free_remaining/paid_available as part of the
    // same transaction (both on success and on a "no_credit" rejection, where
    // 0/0 is the accurate value by construction — see
    // create_patient_check_with_quota). Patching ["checkQuota", phone]
    // directly from that response avoids the 30s staleTime letting a second
    // attempt within the same window see pre-consumption quota and skip the
    // payment form entirely.
    onSuccess: (result, variables) => {
      if (result.allowed) {
        queryClient.setQueryData(["checkQuota", variables.phone], {
          freeRemaining: result.freeRemaining,
          paidAvailable: result.paidAvailable,
          phoneVerified: true,
        });
        queryClient.invalidateQueries({ queryKey: ["patientChecks"] });
        queryClient.invalidateQueries({ queryKey: ["patientChecksForDevice"] });
        return;
      }
      if (result.reason === "no_credit") {
        queryClient.setQueryData(["checkQuota", variables.phone], {
          freeRemaining: result.freeRemaining,
          paidAvailable: result.paidAvailable,
          phoneVerified: true,
        });
      }
    },
  });
}

export function usePatientCheck(id: string | null) {
  return useQuery({
    queryKey: ["patientCheck", id],
    queryFn: () => getPatientCheckById(id as string),
    enabled: !!id,
  });
}

export function usePatientCheckByShareToken(token: string | null) {
  return useQuery({
    queryKey: ["patientCheckByToken", token],
    queryFn: () => getPatientCheckByShareToken(token as string),
    enabled: !!token,
  });
}

/** Broad, authenticated-only — the compliance center and the audit event feed. */
export function usePatientChecks() {
  return useQuery({
    queryKey: ["patientChecks"],
    queryFn: listPatientChecks,
  });
}

/** Device-scoped — the anonymous /check/history page, this device's own checks only. */
export function usePatientChecksForDevice() {
  return useQuery({
    queryKey: ["patientChecksForDevice"],
    queryFn: listPatientChecksForDevice,
  });
}

export function useMarkPatientCheckPulled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, prescriptionId }: { id: string; prescriptionId: string }) =>
      markPatientCheckPulled(id, prescriptionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patientChecks"] }),
  });
}

export type { PatientCheck };
