"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePatient } from "../../data/repositories/patientRepository";
import type { Patient } from "../../types";

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; patient: Omit<Patient, "id" | "ownerId" | "institutionId"> }) =>
      updatePatient(vars.id, vars.patient),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
    },
  });
}
