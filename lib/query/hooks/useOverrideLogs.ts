"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listOverrideLogs,
  type OverrideLogFilters,
} from "../../data/repositories/overrideLogRepository";

export function useOverrideLogs(filters: OverrideLogFilters = {}) {
  return useQuery({
    queryKey: ["overrideLogs", filters],
    queryFn: () => listOverrideLogs(filters),
  });
}
