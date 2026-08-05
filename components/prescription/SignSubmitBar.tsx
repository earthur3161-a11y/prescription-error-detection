import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VerdictMark } from "@/components/ui/VerdictMark";
import type { Verdict } from "@/lib/screening-engine";

interface SignSubmitBarProps {
  verdictCounts: Record<Verdict, number>;
  canSubmit: boolean;
  blockingReason?: string;
  submitting?: boolean;
  onSubmit: () => void;
  submitLabel?: string;
  submittingLabel?: string;
}

export function SignSubmitBar({
  verdictCounts,
  canSubmit,
  blockingReason,
  submitting,
  onSubmit,
  submitLabel = "Sign & Submit Prescription",
  submittingLabel = "Submitting…",
}: SignSubmitBarProps) {
  return (
    <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-surface/95 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
        {(["safe", "caution", "blocked"] as const).map(
          (v) =>
            verdictCounts[v] > 0 && (
              <span key={v} className="flex items-center gap-1.5">
                <VerdictMark verdict={v} size="chip" />
                <span>× {verdictCounts[v]}</span>
              </span>
            )
        )}
        {blockingReason && !canSubmit && (
          <span className="text-caution-fg">{blockingReason}</span>
        )}
      </div>
      <Button size="lg" onClick={onSubmit} disabled={!canSubmit || submitting}>
        <CheckCircle2 className="size-5" aria-hidden="true" />
        {submitting ? submittingLabel : submitLabel}
      </Button>
    </div>
  );
}
