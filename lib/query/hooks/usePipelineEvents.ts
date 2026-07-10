"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listAllPipelineEvents,
  listPipelineEvents,
} from "../../data/repositories/pipelineEventRepository";

export function usePipelineEvents(prescriptionId: string | null) {
  return useQuery({
    queryKey: ["pipelineEvents", prescriptionId],
    queryFn: () => listPipelineEvents(prescriptionId as string),
    enabled: !!prescriptionId,
  });
}

export function useAllPipelineEvents() {
  return useQuery({ queryKey: ["pipelineEvents"], queryFn: listAllPipelineEvents });
}
