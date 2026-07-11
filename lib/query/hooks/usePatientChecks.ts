"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPatientCheck,
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
    mutationFn: createPatientCheck,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patientChecks"] });
      queryClient.invalidateQueries({ queryKey: ["patientChecksForDevice"] });
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
