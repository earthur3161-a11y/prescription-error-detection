"use client";

import { useQuery } from "@tanstack/react-query";
import { listProfiles } from "../../data/repositories/profileRepository";
import type { Profile } from "../../types";

/**
 * One bulk fetch of every profile, returned as a Map for O(1) name/title
 * lookups. Several call sites resolve an identity inside a .map() render
 * loop — a per-row useProfile(id) hook would be both a Rules-of-Hooks
 * violation and an N+1 query storm there, so this is the only safe shape.
 */
export function useProfiles(enabled = true) {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const profiles = await listProfiles();
      return new Map(profiles.map((p) => [p.id, p]));
    },
    enabled,
  });
}

export type { Profile };
