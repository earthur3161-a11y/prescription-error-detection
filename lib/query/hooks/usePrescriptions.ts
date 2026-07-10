"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getPrescriptionById,
  listPrescriptions,
  type PrescriptionFilters,
} from "../../data/repositories/prescriptionRepository";

export function usePrescriptions(filters: PrescriptionFilters = {}) {
  return useQuery({
    queryKey: ["prescriptions", filters],
    queryFn: () => listPrescriptions(filters),
  });
}

export function usePrescription(id: string | null) {
  return useQuery({
    queryKey: ["prescription", id],
    queryFn: () => getPrescriptionById(id as string),
    enabled: !!id,
  });
}
