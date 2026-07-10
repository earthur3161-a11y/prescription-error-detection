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
