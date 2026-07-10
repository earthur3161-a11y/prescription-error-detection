"use client";

import { useQuery } from "@tanstack/react-query";
import { getPatientById } from "../../data/repositories/patientRepository";

export function usePatient(id: string | null) {
  return useQuery({
    queryKey: ["patient", id],
    queryFn: () => getPatientById(id as string),
    enabled: !!id,
  });
}
