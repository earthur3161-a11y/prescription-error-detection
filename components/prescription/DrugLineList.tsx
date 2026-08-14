import { VerdictCard } from "./VerdictCard";
import type { Drug, OverrideLog, PrescriptionDrugLine } from "@/lib/types";
import type { DrugLineVerdict } from "@/lib/screening-engine";

interface DrugLineListProps {
  lines: PrescriptionDrugLine[];
  drugs: Drug[];
  verdicts: Record<string, DrugLineVerdict>;
  overrideLogs: Record<string, OverrideLog>;
  onChangeLine: (line: PrescriptionDrugLine) => void;
  onRemoveLine: (lineId: string) => void;
  onOverrideLine: (lineId: string) => void;
}

export function DrugLineList({
  lines,
  drugs,
  verdicts,
  overrideLogs,
  onChangeLine,
  onRemoveLine,
  onOverrideLine,
}: DrugLineListProps) {
  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong px-6 py-10 text-center text-sm text-muted-foreground">
        No drugs added yet. Search above to add the first drug to this prescription.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/*
        A legend, not an aligned table header — VerdictCard's row is
        flex-wrap with a flex-1 name element, so exact column alignment
        isn't achievable without converting it to CSS grid (a bigger change
        than this needs). Hidden below sm: fields already wrap under the
        name there, so a header would misalign more, not less. The per-line
        connector text (`mg ×`, `/day ×`, `days ·`) stays even with this
        present — at the 8-10 line lengths this screen is tuned for, the
        header scrolls out of view long before the last line, and those
        inline units are the only per-row signal left at that point.
      */}
      <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:flex">
        <span className="min-w-[9rem] flex-1" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
          <span className="w-36">Route</span>
          <span className="w-20">Dose (mg)</span>
          <span className="w-14">Freq/day</span>
          <span className="w-14">Duration</span>
        </div>
        <span className="ml-auto w-[72px]" aria-hidden="true" />
      </div>
      {lines.map((line) => {
        const drug = drugs.find((d) => d.id === line.drugId);
        const verdict = verdicts[line.id];
        if (!drug || !verdict) return null;
        return (
          <VerdictCard
            key={line.id}
            drug={drug}
            line={line}
            verdict={verdict}
            overrideLog={overrideLogs[line.id]}
            onChange={onChangeLine}
            onRemove={() => onRemoveLine(line.id)}
            onOverride={() => onOverrideLine(line.id)}
          />
        );
      })}
    </div>
  );
}
