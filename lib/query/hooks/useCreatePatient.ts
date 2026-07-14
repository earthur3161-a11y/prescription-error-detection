"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPatient } from "../../data/repositories/patientRepository";
import type { Patient } from "../../types";

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { patient: Omit<Patient, "id" | "ownerId">; ownerId: string }) =>
      createPatient(vars.patient, vars.ownerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
