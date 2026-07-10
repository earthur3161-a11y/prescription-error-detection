"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFacilityPolicy, updateFacilityPolicy } from "../../data/repositories/facilityPolicyRepository";

export function useFacilityPolicy() {
  return useQuery({
    queryKey: ["facilityPolicy"],
    queryFn: getFacilityPolicy,
  });
}

export function useUpdateFacilityPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateFacilityPolicy,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["facilityPolicy"] }),
  });
}
