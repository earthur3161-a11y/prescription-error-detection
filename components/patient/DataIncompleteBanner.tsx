import { Notice } from "@/components/ui/Notice";
import type { Patient } from "@/lib/types";

interface DataIncompleteBannerProps {
  patient: Patient;
}

/**
 * Missing patient data, not a caution-severity finding — this is exactly
 * the confirmed-vs-unknown distinction the verdict system draws elsewhere,
 * so it uses the same "unknown" tone rather than the caution/warning one.
 */
export function DataIncompleteBanner({ patient }: DataIncompleteBannerProps) {
  const missing: string[] = [];
  if (patient.allergies === null) missing.push("allergy history");
  if (patient.activeMedications === null) missing.push("current medications");
  if (patient.weightKg === null) missing.push("weight");

  if (missing.length === 0) return null;

  return (
    <Notice tone="unknown" title="Data incomplete — verify manually">
      No {missing.join(", ")} on file for {patient.name}. Every drug line will be flagged for
      review until this is confirmed.
    </Notice>
  );
}
