import type { ActiveMedication, Drug } from "@/lib/types";
import { formatDate } from "@/lib/utils/date";

interface MedicationListProps {
  medications: ActiveMedication[] | null;
  drugs: Drug[];
}

export function MedicationList({ medications, drugs }: MedicationListProps) {
  if (medications === null) {
    return <p className="text-sm text-caution-fg">Not on file — verify manually.</p>;
  }
  if (medications.length === 0) {
    return <p className="text-sm text-muted-foreground">No active medications recorded.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {medications.map((m, i) => {
        const drug = drugs.find((d) => d.id === m.drugId);
        return (
          <li key={`${m.drugId}-${i}`} className="text-sm text-secondary">
            {drug?.generic_name ?? m.drugId}
            <span className="text-subtle"> — since {formatDate(m.startedAt)}</span>
          </li>
        );
      })}
    </ul>
  );
}
