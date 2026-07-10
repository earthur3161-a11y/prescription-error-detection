"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listPendingOutboxItems, syncOutbox } from "../../data/repositories/outboxRepository";
import { useToastStore } from "../../store/toast-store";

export function usePendingOutbox() {
  return useQuery({
    queryKey: ["outbox"],
    queryFn: listPendingOutboxItems,
    refetchInterval: 10_000,
  });
}

export function useSyncOutbox() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  return useMutation({
    mutationFn: syncOutbox,
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["outbox"] });
      showToast({
        title: count > 0 ? "Sync complete" : "Nothing to sync",
        description:
          count > 0 ? `${count} item${count === 1 ? "" : "s"} synced.` : "All data already up to date.",
        variant: "success",
      });
    },
  });
}
