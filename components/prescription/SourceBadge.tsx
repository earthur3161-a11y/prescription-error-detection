import { ClipboardCheck, Smartphone, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { PrescriptionSource } from "@/lib/types";

const SOURCE_CONFIG: Record<PrescriptionSource, { label: string; icon: typeof Stethoscope }> = {
  physician: { label: "Physician", icon: Stethoscope },
  patient_submitted: { label: "Patient-submitted", icon: Smartphone },
  walk_in: { label: "Walk-in", icon: ClipboardCheck },
};

export function SourceBadge({ source }: { source: PrescriptionSource }) {
  const { label, icon: Icon } = SOURCE_CONFIG[source];
  return (
    <Badge tone="neutral">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </Badge>
  );
}
