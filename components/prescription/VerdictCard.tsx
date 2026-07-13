"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { VerdictBadge } from "@/components/ui/VerdictBadge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { FLAG_COLOR_CLASS, FLAG_ICON } from "@/lib/utils/flagPresentation";
import type { Drug, OverrideLog, PrescriptionDrugLine, Route } from "@/lib/types";
import type { DrugLineVerdict, Flag } from "@/lib/screening-engine";

interface VerdictCardProps {
  drug: Drug;
  line: PrescriptionDrugLine;
  verdict: DrugLineVerdict;
  overrideLog?: OverrideLog;
  onChange: (line: PrescriptionDrugLine) => void;
  onRemove: () => void;
  onOverride: () => void;
}

function FlagRow({ flag }: { flag: Flag }) {
  const Icon = FLAG_ICON[flag.severity];
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0", FLAG_COLOR_CLASS[flag.severity])} aria-hidden="true" />
      <p className="text-sm text-secondary">{flag.message}</p>
    </li>
  );
}

export function VerdictCard({
  drug,
  line,
  verdict,
  overrideLog,
  onChange,
  onRemove,
  onOverride,
}: VerdictCardProps) {
  const [expanded, setExpanded] = useState(verdict.verdict !== "safe");
  const needsOverride = verdict.verdict !== "safe";
  const dailyTotal = line.doseMg * line.frequencyPerDay;

  const borderTone =
    verdict.verdict === "blocked"
      ? "border-l-4 border-l-blocked-fg"
      : verdict.verdict === "caution"
        ? "border-l-4 border-l-caution-fg"
        : "border-l-4 border-l-safe-fg";

  return (
    <Card className={cn("transition-colors", borderTone)}>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">
              {drug.generic_name}
              <span className="ml-1.5 text-sm font-normal text-subtle">{drug.class}</span>
            </h3>
            <p className="text-sm text-muted-foreground">
              {line.doseMg}mg × {line.frequencyPerDay}/day for {line.durationDays} days ·{" "}
              {dailyTotal}mg/day total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={verdict.verdict} />
            <button
              onClick={onRemove}
              aria-label={`Remove ${drug.generic_name} from prescription`}
              className="rounded-lg p-2 text-subtle hover:bg-muted hover:text-blocked-fg"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Route</label>
            <Select
              value={line.route}
              onChange={(e) => onChange({ ...line, route: e.target.value as Route })}
              aria-label={`Route for ${drug.generic_name}`}
            >
              {drug.route.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Dose (mg)</label>
            <Input
              type="number"
              min={0}
              value={line.doseMg}
              onChange={(e) => onChange({ ...line, doseMg: Number(e.target.value) || 0 })}
              aria-label={`Dose in milligrams for ${drug.generic_name}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Times/day</label>
            <Input
              type="number"
              min={1}
              value={line.frequencyPerDay}
              onChange={(e) => onChange({ ...line, frequencyPerDay: Number(e.target.value) || 1 })}
              aria-label={`Frequency per day for ${drug.generic_name}`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Duration (days)</label>
            <Input
              type="number"
              min={1}
              value={line.durationDays}
              onChange={(e) => onChange({ ...line, durationDays: Number(e.target.value) || 1 })}
              aria-label={`Duration in days for ${drug.generic_name}`}
            />
          </div>
        </div>

        {verdict.flags.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-foreground"
              aria-expanded={expanded}
            >
              <ChevronDown
                className={cn("size-4 transition-transform", expanded && "rotate-180")}
                aria-hidden="true"
              />
              {verdict.flags.length} flag{verdict.flags.length === 1 ? "" : "s"}
            </button>
            {expanded && (
              <ul className="mt-1 divide-y divide-border border-t border-border">
                {verdict.flags.map((flag, i) => (
                  <FlagRow key={`${flag.code}-${i}`} flag={flag} />
                ))}
              </ul>
            )}
          </div>
        )}

        {needsOverride && (
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
            {overrideLog ? (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Badge tone={verdict.verdict}>Overridden</Badge>
                <span>{overrideLog.reasonText || overrideLog.reasonCode}</span>
              </div>
            ) : (
              <p className="text-sm text-secondary">
                This line must be overridden with a logged reason before submitting.
              </p>
            )}
            {!overrideLog && (
              <Button size="sm" variant={verdict.verdict === "blocked" ? "destructive" : "secondary"} onClick={onOverride}>
                Override
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
