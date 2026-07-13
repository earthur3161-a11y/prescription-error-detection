"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useCreatePatientFeedbackReport } from "@/lib/query/hooks/usePatientFeedback";

interface ReportIssueButtonProps {
  patientCheckId?: string;
}

/**
 * The patient-tier "Error Reporting Dashboard" — a lightweight way to flag
 * that a result seemed wrong. Feeds MediGuard's own quality review, not
 * clinical governance, so it's intentionally just a message, not a form
 * that implies clinical follow-up.
 */
export function ReportIssueButton({ patientCheckId }: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const createReport = useCreatePatientFeedbackReport();

  return (
    <>
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Flag className="size-4" aria-hidden="true" />
        Something seem wrong? Tell us
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Tell us what seemed wrong"
        description="This goes to our quality review team, not your doctor or pharmacist — for urgent concerns, please talk to a pharmacist directly."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={message.trim().length === 0 || createReport.isPending}
              onClick={() => {
                createReport.mutate(
                  { message: message.trim(), patientCheckId },
                  { onSuccess: () => { setOpen(false); setMessage(""); } }
                );
              }}
            >
              Send
            </Button>
          </>
        }
      >
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="e.g. This result didn't match what my pharmacist told me…"
        />
      </Modal>
    </>
  );
}
