"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appendOverrideLog } from "../../data/repositories/overrideLogRepository";
import { enqueueOutboxItem } from "../../data/repositories/outboxRepository";
import { useOfflineStore } from "../../store/offline-store";
import { useToastStore } from "../../store/toast-store";
import type { OverrideLog } from "../../types";

export function useCreateOverrideLog() {
  const queryClient = useQueryClient();
  const simulateOffline = useOfflineStore((s) => s.simulateOffline);
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: async (entry: Omit<OverrideLog, "id" | "timestamp">) => {
      const log = await appendOverrideLog(entry);
      if (simulateOffline) {
        await enqueueOutboxItem("override_log", log.id);
      }
      return log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overrideLogs"] });
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      showToast({
        title: "Override logged",
        description: "This decision has been permanently recorded in the audit trail.",
        variant: "warning",
      });
    },
  });
}
