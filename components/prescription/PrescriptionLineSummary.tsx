import { Card, CardBody } from "@/components/ui/Card";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { Badge } from "@/components/ui/Badge";
import { FlagSeverityIcon } from "@/components/ui/FlagSeverityChip";
import { TONE_BORDER_L_CLASS, getVerdictBasis, getVerdictColorToken } from "@/lib/design/verdictVisuals";
import { formatDateTime } from "@/lib/utils/date";
import type { Drug, OverrideLog, PrescriptionDrugLine } from "@/lib/types";
import type { DrugLineVerdict } from "@/lib/screening-engine";

const REASON_LABELS: Record<string, string> = {
  benefit_outweighs_risk: "Benefit outweighs risk",
  verified_with_pharmacist: "Verified with pharmacist",
  patient_tolerates_combination: "Patient already tolerates this combination",
  other: "Other",
};

interface PrescriptionLineSummaryProps {
  drug: Drug;
  line: PrescriptionDrugLine;
  verdict: DrugLineVerdict;
  overrideLog?: OverrideLog;
}

export function PrescriptionLineSummary({
  drug,
  line,
  verdict,
  overrideLog,
}: PrescriptionLineSummaryProps) {
  const basis = getVerdictBasis(verdict.verdict, verdict.flags);
  const borderTone = TONE_BORDER_L_CLASS[getVerdictColorToken(verdict.verdict, basis)];

  return (
    <Card className={borderTone}>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">
              {drug.generic_name}
              <span className="ml-1.5 text-sm font-normal text-subtle">{drug.class}</span>
            </h3>
            <p className="text-sm text-muted-foreground">
              {line.doseMg}mg {line.route} × {line.frequencyPerDay}/day for {line.durationDays}{" "}
              days
            </p>
            <Badge tone={drug.onEssentialMedicinesList ? "safe" : "caution"} className="mt-1.5">
              {drug.onEssentialMedicinesList ? "On Ghana EML" : "Not on Ghana EML"}
            </Badge>
          </div>
          <VerdictMark verdict={verdict.verdict} flags={verdict.flags} />
        </div>

        {verdict.flags.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {verdict.flags.map((flag, i) => {
              return (
                <li key={`${flag.code}-${i}`} className="flex items-start gap-2.5 py-2">
                  <FlagSeverityIcon severity={flag.severity} size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-secondary">
                      <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {flag.severity}
                      </span>
                      {flag.message}
                    </p>
                    {flag.referenceSource && (
                      <p className="mt-0.5 text-xs text-subtle">Source: {flag.referenceSource}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {overrideLog && (
          <div className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={verdict.verdict}>Override logged</Badge>
              <span className="text-subtle">{formatDateTime(overrideLog.timestamp)}</span>
            </div>
            <p className="font-medium text-secondary">
              {REASON_LABELS[overrideLog.reasonCode] ?? overrideLog.reasonCode}
            </p>
            {overrideLog.reasonText && (
              <p className="mt-0.5 text-secondary">{overrideLog.reasonText}</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
