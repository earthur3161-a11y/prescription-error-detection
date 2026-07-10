import { AlertTriangle } from "lucide-react";
import type { Patient } from "@/lib/types";

interface DataIncompleteBannerProps {
  patient: Patient;
}

export function DataIncompleteBanner({ patient }: DataIncompleteBannerProps) {
  const missing: string[] = [];
  if (patient.allergies === null) missing.push("allergy history");
  if (patient.activeMedications === null) missing.push("current medications");
  if (patient.weightKg === null) missing.push("weight");

  if (missing.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-caution-border bg-caution-bg px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-caution-fg" aria-hidden="true" />
      <p className="text-sm text-caution-fg">
        <span className="font-semibold">Data incomplete — verify manually.</span> No{" "}
        {missing.join(", ")} on file for {patient.name}. Every drug line will be flagged for
        review until this is confirmed.
      </p>
    </div>
  );
}
