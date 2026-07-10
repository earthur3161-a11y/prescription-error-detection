"use client";

import { useQuery } from "@tanstack/react-query";
import { getCachedFormularyBundle, searchDrugs, searchDrugsFuzzy } from "../../data/repositories/drugRepository";
import { DEFAULT_REGION } from "../../formulary";

export function useFormulary(region: string = DEFAULT_REGION) {
  return useQuery({
    queryKey: ["formulary", region],
    queryFn: () => getCachedFormularyBundle(region),
    staleTime: 5 * 60_000,
  });
}

export function useDrugSearch(query: string) {
  return useQuery({
    queryKey: ["drugSearch", query],
    queryFn: () => searchDrugs(query),
  });
}

/** Typo-tolerant variant for patient-facing search (misspellings, brand names). */
export function useDrugSearchFuzzy(query: string) {
  return useQuery({
    queryKey: ["drugSearchFuzzy", query],
    queryFn: () => searchDrugsFuzzy(query),
  });
}
