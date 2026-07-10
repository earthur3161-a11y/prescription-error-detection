"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPatientFeedbackReport,
  listPatientFeedbackReports,
} from "../../data/repositories/patientFeedbackRepository";
import { useToastStore } from "../../store/toast-store";

export function usePatientFeedbackReports() {
  return useQuery({
    queryKey: ["patientFeedbackReports"],
    queryFn: listPatientFeedbackReports,
  });
}

export function useCreatePatientFeedbackReport() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);
  return useMutation({
    mutationFn: createPatientFeedbackReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patientFeedbackReports"] });
      showToast({
        title: "Thanks for letting us know",
        description: "Our clinical review team will take a look.",
        variant: "success",
      });
    },
  });
}
