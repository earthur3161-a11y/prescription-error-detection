"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearLocalPatientProfile,
  getLocalPatientProfile,
  saveLocalPatientProfile,
} from "../../data/repositories/patientProfileRepository";

export function useLocalPatientProfile() {
  return useQuery({
    queryKey: ["patientProfile"],
    queryFn: getLocalPatientProfile,
  });
}

export function useSaveLocalPatientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveLocalPatientProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patientProfile"] }),
  });
}

export function useClearLocalPatientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearLocalPatientProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patientProfile"] }),
  });
}
