import { Clock, Info, Pill, Snowflake, TimerReset } from "lucide-react";
import { counselingFor, dosageInstruction } from "@/lib/pharmacy/counseling";
import type { Drug, PrescriptionDrugLine } from "@/lib/types";

interface CounselingSheetProps {
  drug: Drug;
  line: PrescriptionDrugLine;
}

/** Point-of-dispensing counseling reference for one drug (stage 1.6). */
export function CounselingSheet({ drug, line }: CounselingSheetProps) {
  const points = counselingFor(drug);
  const rows = [
    { Icon: Pill, label: "How to take it", text: dosageInstruction(drug, line) },
    { Icon: Info, label: "Administration advice", text: points.administration },
    { Icon: Clock, label: "Common side effects", text: points.sideEffects },
    { Icon: Snowflake, label: "Storage", text: points.storage },
    { Icon: TimerReset, label: "If you miss a dose", text: points.missedDose },
  ];

  return (
    <div className="space-y-2.5">
      <p className="font-medium text-foreground">{drug.generic_name} counseling</p>
      <ul className="space-y-2">
        {rows.map(({ Icon, label, text }) => (
          <li key={label} className="flex items-start gap-2.5 text-sm">
            <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>
              <span className="font-medium text-secondary">{label}: </span>
              <span className="text-secondary">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
