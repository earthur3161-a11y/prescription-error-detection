import { cn } from "@/lib/utils/cn";
import {
  SEVERITY_COLOR_TOKEN,
  SEVERITY_LABEL,
  SEVERITY_SHAPE,
  TONE_BG_CLASS,
  TONE_TEXT_CLASS,
  TONE_VAR,
} from "@/lib/design/verdictVisuals";
import { SHAPE_COMPONENT } from "@/components/ui/shapes";
import type { Severity } from "@/lib/screening-engine";

interface FlagSeverityIconProps {
  severity: Severity;
  size?: number;
  className?: string;
}

/**
 * Bare shape+color, no text — for use directly beside a full clinical
 * sentence (a flag row's own message, a findings group's own label), where
 * that adjacent text already carries the "what is this" job. Not for a cell
 * with no other content — use FlagSeverityChip for that; unlike this icon,
 * it structurally can't render caution/blocked without its text label.
 */
export function FlagSeverityIcon({ severity, size = 18, className }: FlagSeverityIconProps) {
  const Shape = SHAPE_COMPONENT[SEVERITY_SHAPE[severity]];
  return <Shape size={size} color={TONE_VAR[SEVERITY_COLOR_TOKEN[severity]]} className={className} />;
}

interface FlagSeverityChipProps {
  severity: Severity;
  className?: string;
}

/**
 * A standalone compact chip (icon + uppercase severity word) — the
 * findings-list case that has no other adjacent text of its own. Always
 * renders its label: unlike the bare icon above, this one has nothing else
 * on the row to carry the meaning if the text were dropped, so there's no
 * icon-only variant to even offer here.
 */
export function FlagSeverityChip({ severity, className }: FlagSeverityChipProps) {
  const tone = SEVERITY_COLOR_TOKEN[severity];
  const Shape = SHAPE_COMPONENT[SEVERITY_SHAPE[severity]];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        TONE_BG_CLASS[tone],
        TONE_TEXT_CLASS[tone],
        className
      )}
    >
      <Shape size={11} color={TONE_VAR[tone]} />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}
