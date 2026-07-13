import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { StepBadge } from "@/components/ui/StepBadge";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { cn } from "@/lib/utils/cn";
import { FLAG_ICON } from "@/lib/utils/flagPresentation";
import { getPatientGuidance } from "@/lib/patient-check/guidance";
import { buildSyntheticPatient } from "@/lib/patient-check/buildSyntheticPatient";
import {
  overallVerdict,
  screenDrugLine,
  type DrugLineVerdict,
  type Flag,
  type Verdict,
} from "@/lib/screening-engine";
import type { FormularyBundle, PatientCheck } from "@/lib/types";

/**
 * Several checks independently guard the same missing data (by design, for
 * clinical defense-in-depth) which can produce near-duplicate plain-language
 * sentences. A patient seeing the same sentence twice reads as a bug, so
 * collapse flags that resolve to identical patient-facing text.
 */
function dedupeByPatientText(flags: Flag[]): Flag[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    if (seen.has(flag.audience_variant.patient)) return false;
    seen.add(flag.audience_variant.patient);
    return true;
  });
}

const verdictBannerClasses: Record<Verdict, string> = {
  safe: "bg-safe-bg border-safe-border text-safe-fg",
  caution: "bg-caution-bg border-caution-border text-caution-fg",
  blocked: "bg-blocked-bg border-blocked-border text-blocked-fg",
};

const verdictIcon: Record<Verdict, typeof CheckCircle2> = {
  safe: CheckCircle2,
  caution: AlertTriangle,
  blocked: XCircle,
};

const verdictLabel: Record<Verdict, string> = {
  safe: "Looks safe",
  caution: "Check with pharmacist",
  blocked: "Talk to a professional",
};

interface ResultViewProps {
  check: PatientCheck;
  formulary: FormularyBundle;
}

export function ResultView({ check, formulary }: ResultViewProps) {
  const drugs = formulary.drugs;

  // Re-screen live against the current formulary rather than trusting the
  // verdicts stored when the check was created. This guarantees the full engine
  // (allergy, drug-drug interaction, dosage, duplicate, EML) runs against the
  // latest drug data — so results stay correct even for checks saved before the
  // data was updated, instead of showing stale flags (e.g. an out-of-date
  // "not on the EML" label).
  const syntheticPatient = buildSyntheticPatient(check.profile);
  const liveVerdicts: DrugLineVerdict[] = check.drugs.map((line) =>
    screenDrugLine({ patient: syntheticPatient, drugLine: line, otherLines: check.drugs, formulary })
  );

  const verdict = overallVerdict(liveVerdicts);
  const guidance = getPatientGuidance(verdict);
  const Icon = verdictIcon[verdict];

  return (
    <div className="space-y-6">
      <div className={cn("rounded-2xl border-2 p-6 text-center sm:p-8", verdictBannerClasses[verdict])}>
        <Icon className="mx-auto mb-3 size-12 sm:size-14" aria-hidden="true" />
        <h1 className="text-xl font-semibold sm:text-2xl">{guidance.headline}</h1>
        <p className="mt-1.5 text-sm opacity-90">{guidance.detail}</p>
      </div>

      <Card>
        <CardBody className="space-y-1.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">
            What should I do next?
          </h2>
          <ul className="space-y-2 pt-1">
            {guidance.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-secondary">
                <StepBadge step={i + 1} className="mt-0.5" />
                {step}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="space-y-3">
        {check.drugs.map((line, i) => {
          const drug = drugs.find((d) => d.id === line.drugId);
          const lineVerdict = liveVerdicts[i];
          if (!drug || !lineVerdict) return null;
          return (
            <Card key={line.id}>
              <CardBody className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{drug.generic_name}</p>
                  <VerdictBadge verdict={lineVerdict.verdict} label={verdictLabel[lineVerdict.verdict]} size="sm" />
                </div>
                <p className="text-xs text-subtle">
                  {drug.onEssentialMedicinesList
                    ? "On Ghana's standard list of essential medicines."
                    : "Not on Ghana's standard list of essential medicines."}
                </p>
                {lineVerdict.flags.length > 0 && (
                  <ul className="space-y-1.5">
                    {dedupeByPatientText(lineVerdict.flags).map((flag, fi) => {
                      const FlagIcon = FLAG_ICON[flag.severity];
                      return (
                        <li key={fi} className="flex items-start gap-2 text-sm text-secondary">
                          <FlagIcon className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
                          {flag.audience_variant.patient}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
