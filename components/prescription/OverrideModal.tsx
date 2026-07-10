"use client";

import { useState } from "react";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { OverrideReasonCode, Verdict } from "@/lib/types";

interface OverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drugName: string;
  verdict: Extract<Verdict, "caution" | "blocked">;
  onConfirm: (reasonCode: OverrideReasonCode, reasonText: string) => void;
  submitting?: boolean;
}

const REASON_OPTIONS: { value: OverrideReasonCode; label: string }[] = [
  { value: "benefit_outweighs_risk", label: "Benefit outweighs risk" },
  { value: "verified_with_pharmacist", label: "Verified with pharmacist" },
  { value: "patient_tolerates_combination", label: "Patient already tolerates this combination" },
  { value: "other", label: "Other (specify below)" },
];

const schema = z
  .object({
    reasonCode: z.enum([
      "benefit_outweighs_risk",
      "verified_with_pharmacist",
      "patient_tolerates_combination",
      "other",
    ]),
    reasonText: z.string(),
  })
  .refine((data) => data.reasonCode !== "other" || data.reasonText.trim().length >= 5, {
    message: "Please provide detail when selecting \"Other\".",
    path: ["reasonText"],
  });

export function OverrideModal({
  open,
  onOpenChange,
  drugName,
  verdict,
  onConfirm,
  submitting,
}: OverrideModalProps) {
  const [reasonCode, setReasonCode] = useState<OverrideReasonCode>("benefit_outweighs_risk");
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    const result = schema.safeParse({ reasonCode, reasonText });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please complete this field.");
      return;
    }
    setError(null);
    onConfirm(reasonCode, reasonText.trim());
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Override ${verdict === "blocked" ? "Blocked" : "Caution"} verdict`}
      description={`You are proceeding with ${drugName} against MediGuard's safety screening. This decision will be permanently logged with your identity and timestamp.`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={verdict === "blocked" ? "destructive" : "primary"}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? "Logging…" : "Confirm override"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="override-reason" className="mb-1.5 block text-sm font-medium text-secondary">
            Reason <span className="text-blocked-fg">*</span>
          </label>
          <Select
            id="override-reason"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as OverrideReasonCode)}
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="override-detail" className="mb-1.5 block text-sm font-medium text-secondary">
            Additional detail {reasonCode === "other" && <span className="text-blocked-fg">*</span>}
          </label>
          <textarea
            id="override-detail"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
            placeholder="Optional context for the audit trail…"
          />
          {error && <p className="mt-1.5 text-sm text-blocked-fg">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
