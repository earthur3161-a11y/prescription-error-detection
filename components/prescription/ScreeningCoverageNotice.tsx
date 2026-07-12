import { Info } from "lucide-react";
import type { FormularyBundle } from "@/lib/types";

interface ScreeningCoverageNoticeProps {
  formulary: FormularyBundle;
}

/**
 * Persistent disclosure of what automated screening actually covers.
 * checkInteraction/checkAllergy silently skip any pair or class that isn't
 * in the formulary's rule tables — a missing rule and a checked-safe pair
 * are indistinguishable downstream, so without this notice a clean verdict
 * reads as "no interaction exists" rather than "none of our known rules
 * matched." Counts are read from the live formulary bundle so this stays
 * accurate as coverage grows.
 */
export function ScreeningCoverageNotice({ formulary }: ScreeningCoverageNoticeProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted px-4 py-3">
      <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Automated screening has limited coverage.</span>{" "}
        Checked against {formulary.interactionRules.length} known drug-drug interaction rules and{" "}
        {formulary.allergyRules.length} allergy-class rules — not a comprehensive interaction
        database. A clean result means nothing matched what we check for, not that no interaction
        exists. Use clinical judgment for combinations not covered here.
      </p>
    </div>
  );
}
