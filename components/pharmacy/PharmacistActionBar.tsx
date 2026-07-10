"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, PackageCheck, PauseCircle, Stethoscope, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type { PharmacyState } from "@/lib/pharmacy/status";

type Mode = "hold" | "reject" | "clarify" | "intervention";

interface DrugRef {
  id: string;
  name: string;
}

interface PharmacistActionBarProps {
  state: PharmacyState;
  drugs: DrugRef[];
  pending: boolean;
  onApprove: () => void;
  onHold: (reason: string) => void;
  onReject: (reason: string) => void;
  onRequestClarification: (drugId: string | undefined, question: string) => void;
  onRecordIntervention: (reason: string, outcome: string) => void;
  onDispense: () => void;
}

/**
 * The six first-class pharmacist actions, always visible during Review. Approve
 * and Dispense are direct; the rest open a small reason/structure modal. Dispense
 * is only enabled once the prescription has been Approved (Cleared).
 */
export function PharmacistActionBar({
  state,
  drugs,
  pending,
  onApprove,
  onHold,
  onReject,
  onRequestClarification,
  onRecordIntervention,
  onDispense,
}: PharmacistActionBarProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState("");
  const [clarifyDrug, setClarifyDrug] = useState<string>("");

  const finished = state === "dispensed" || state === "rejected";
  const canDispense = state === "cleared";

  function close() {
    setMode(null);
    setReason("");
    setOutcome("");
    setClarifyDrug("");
  }

  const modalConfig: Record<Mode, { title: string; description: string; confirmLabel: string; destructive?: boolean; needsOutcome?: boolean; needsDrug?: boolean }> = {
    hold: { title: "Hold prescription", description: "Pause pending more information or stock. It stays in the On-Hold queue.", confirmLabel: "Hold" },
    reject: { title: "Reject prescription", description: "Stops this prescription entirely. A reason is required and is logged.", confirmLabel: "Reject", destructive: true },
    clarify: { title: "Request clarification from prescriber", description: "Sends a structured question. The prescription stays Held until a response is logged.", confirmLabel: "Send request", needsDrug: true },
    intervention: { title: "Record intervention", description: "Log an issue you caught and corrected — quick reason + outcome.", confirmLabel: "Record", needsOutcome: true },
  };

  const cfg = mode ? modalConfig[mode] : null;
  const reasonMissing = reason.trim().length === 0;
  const outcomeMissing = cfg?.needsOutcome && outcome.trim().length === 0;

  function confirm() {
    if (!mode) return;
    if (mode === "hold") onHold(reason.trim());
    else if (mode === "reject") onReject(reason.trim());
    else if (mode === "clarify") onRequestClarification(clarifyDrug || undefined, reason.trim());
    else if (mode === "intervention") onRecordIntervention(reason.trim(), outcome.trim());
    close();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApprove} disabled={pending || finished || state === "cleared"}>
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Approve
        </Button>
        <Button onClick={onDispense} disabled={pending || !canDispense} variant={canDispense ? "primary" : "secondary"}>
          <PackageCheck className="size-5" aria-hidden="true" />
          Dispense
        </Button>
        <Button variant="secondary" onClick={() => setMode("hold")} disabled={pending || finished}>
          <PauseCircle className="size-5" aria-hidden="true" />
          Hold
        </Button>
        <Button variant="secondary" onClick={() => setMode("clarify")} disabled={pending || finished}>
          <HelpCircle className="size-5" aria-hidden="true" />
          Request Clarification
        </Button>
        <Button variant="secondary" onClick={() => setMode("intervention")} disabled={pending}>
          <Stethoscope className="size-5" aria-hidden="true" />
          Record Intervention
        </Button>
        <Button variant="destructive" onClick={() => setMode("reject")} disabled={pending || finished}>
          <XCircle className="size-5" aria-hidden="true" />
          Reject
        </Button>
      </div>

      {cfg && (
        <Modal
          open={!!mode}
          onOpenChange={(o) => !o && close()}
          title={cfg.title}
          description={cfg.description}
          footer={
            <>
              <Button variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                variant={cfg.destructive ? "destructive" : "primary"}
                disabled={reasonMissing || outcomeMissing}
                onClick={confirm}
              >
                {cfg.confirmLabel}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {cfg.needsDrug && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">About which drug? (optional)</label>
                <Select value={clarifyDrug} onChange={(e) => setClarifyDrug(e.target.value)}>
                  <option value="">Whole prescription</option>
                  {drugs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-secondary">
                {mode === "clarify" ? "Your question" : mode === "intervention" ? "What did you catch?" : "Reason"}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                placeholder={
                  mode === "clarify"
                    ? "e.g. Please confirm the intended frequency for amoxicillin."
                    : mode === "intervention"
                      ? "e.g. Prescribed dose exceeded daily max."
                      : "Reason…"
                }
              />
            </div>
            {cfg.needsOutcome && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-secondary">Outcome</label>
                <textarea
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                  placeholder="e.g. Dose reduced to 500mg after confirming with prescriber."
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
