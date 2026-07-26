"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPatient } from "../../data/repositories/patientRepository";
import type { Patient } from "../../types";

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      patient: Omit<Patient, "id" | "ownerId" | "institutionId">;
      ownerId: string;
      institutionId: string | null;
    }) => createPatient(vars.patient, vars.ownerId, vars.institutionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
