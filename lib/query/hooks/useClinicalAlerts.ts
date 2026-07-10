"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listClinicalAlerts,
  type ClinicalAlertFilters,
} from "../../data/repositories/clinicalAlertRepository";

export function useClinicalAlerts(filters: ClinicalAlertFilters = {}) {
  return useQuery({
    queryKey: ["clinicalAlerts", filters],
    queryFn: () => listClinicalAlerts(filters),
  });
}
