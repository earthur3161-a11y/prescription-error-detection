import { AlertTriangle, HelpCircle, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/date";
import type { Drug, OverrideLog, PrescriptionDrugLine } from "@/lib/types";
import type { DrugLineVerdict, Severity } from "@/lib/screening-engine";

const REASON_LABELS: Record<string, string> = {
  benefit_outweighs_risk: "Benefit outweighs risk",
  verified_with_pharmacist: "Verified with pharmacist",
  patient_tolerates_combination: "Patient already tolerates this combination",
  other: "Other",
};

const flagIcon: Record<Severity, typeof AlertTriangle> = {
  none: AlertTriangle,
  minor: AlertTriangle,
  moderate: AlertTriangle,
  major: XCircle,
  severe: XCircle,
  unknown: HelpCircle,
};

const flagColor: Record<Severity, string> = {
  none: "text-subtle",
  minor: "text-caution-fg",
  moderate: "text-caution-fg",
  major: "text-blocked-fg",
  severe: "text-blocked-fg",
  unknown: "text-muted-foreground",
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
  const borderTone =
    verdict.verdict === "blocked"
      ? "border-l-4 border-l-blocked-fg"
      : verdict.verdict === "caution"
        ? "border-l-4 border-l-caution-fg"
        : "border-l-4 border-l-safe-fg";

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
          <VerdictBadge verdict={verdict.verdict} />
        </div>

        {verdict.flags.length > 0 && (
          <ul className="divide-y divide-border border-t border-border">
            {verdict.flags.map((flag, i) => {
              const Icon = flagIcon[flag.severity];
              return (
                <li key={`${flag.code}-${i}`} className="flex items-start gap-2.5 py-2">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", flagColor[flag.severity])} aria-hidden="true" />
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
