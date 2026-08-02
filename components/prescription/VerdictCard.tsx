"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { VerdictMark } from "@/components/ui/VerdictMark";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { FlagSeverityIcon } from "@/components/ui/FlagSeverityChip";
import { TONE_BORDER_L_CLASS, getVerdictBasis, getVerdictColorToken } from "@/lib/design/verdictVisuals";
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
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      <FlagSeverityIcon severity={flag.severity} size={16} className="mt-0.5 shrink-0" />
      <p className="text-sm text-secondary">{flag.message}</p>
    </li>
  );
}

// Route/dose/frequency/duration fields shrunk from the shared 44px default
// to fit one dense row per drug line — an order-entry grid, not a stack of
// spacious cards, is what "fast at 8-10 drugs" actually requires here.
const FIELD_CLASS = "h-9 px-2.5 text-sm";
// Select needs its own class: overriding its base pr-9 down to FIELD_CLASS's
// symmetric px-2.5 would leave only 10px clearance for the chevron icon
// (absolutely positioned at right-3 + size-4, i.e. spanning 12-28px from the
// edge) — the icon would sit on top of longer route values like
// "subcutaneous" instead of beside them. Left padding still shrinks; right
// padding keeps the base component's chevron clearance untouched.
const SELECT_FIELD_CLASS = "h-9 pl-2.5 text-sm";

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

  const basis = getVerdictBasis(verdict.verdict, verdict.flags);
  const tone = getVerdictColorToken(verdict.verdict, basis);
  const borderTone = TONE_BORDER_L_CLASS[tone];

  return (
    <Card className={cn("transition-colors", borderTone)}>
      <CardBody className="space-y-2.5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-[9rem] flex-1 font-medium leading-tight text-foreground">
            {drug.generic_name}
            <span className="ml-1.5 text-xs font-normal text-subtle">{drug.class}</span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <Select
              value={line.route}
              onChange={(e) => onChange({ ...line, route: e.target.value as Route })}
              aria-label={`Route for ${drug.generic_name}`}
              className={cn(SELECT_FIELD_CLASS, "w-36")}
            >
              {drug.route.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              value={line.doseMg}
              onChange={(e) => onChange({ ...line, doseMg: Number(e.target.value) || 0 })}
              aria-label={`Dose in milligrams for ${drug.generic_name}`}
              className={cn(FIELD_CLASS, "w-20")}
            />
            <span className="text-xs text-subtle">mg ×</span>
            <Input
              type="number"
              min={1}
              value={line.frequencyPerDay}
              onChange={(e) => onChange({ ...line, frequencyPerDay: Number(e.target.value) || 1 })}
              aria-label={`Frequency per day for ${drug.generic_name}`}
              className={cn(FIELD_CLASS, "w-14")}
            />
            <span className="text-xs text-subtle">/day ×</span>
            <Input
              type="number"
              min={1}
              value={line.durationDays}
              onChange={(e) => onChange({ ...line, durationDays: Number(e.target.value) || 1 })}
              aria-label={`Duration in days for ${drug.generic_name}`}
              className={cn(FIELD_CLASS, "w-14")}
            />
            <span className="text-xs text-subtle">days · {dailyTotal}mg/day</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <VerdictMark verdict={verdict.verdict} flags={verdict.flags} size="chip" />
            <button
              onClick={onRemove}
              aria-label={`Remove ${drug.generic_name} from prescription`}
              className="-m-2.5 rounded-lg p-2.5 text-subtle hover:bg-muted hover:text-blocked-fg"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {verdict.flags.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-foreground"
              aria-expanded={expanded}
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
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
          <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
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
