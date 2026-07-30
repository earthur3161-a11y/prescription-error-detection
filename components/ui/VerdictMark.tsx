import { cn } from "@/lib/utils/cn";
import {
  COMPACT_ICON_SAFE_SHAPES,
  TONE_TEXT_CLASS,
  TONE_VAR,
  VERDICT_LABEL,
  getVerdictBasis,
  getVerdictColorToken,
  getVerdictShape,
} from "@/lib/design/verdictVisuals";
import { SHAPE_COMPONENT, UnknownRing } from "@/components/ui/shapes";
import type { Flag, Verdict } from "@/lib/screening-engine";

type MarkSize = "chip" | "badge" | "seal";

const ICON_PX: Record<MarkSize, number> = { chip: 14, badge: 20, seal: 52 };
const TEXT_CLASS: Record<MarkSize, string> = {
  chip: "text-xs",
  badge: "text-sm",
  seal: "text-base",
};
const GAP_CLASS: Record<MarkSize, string> = { chip: "gap-1", badge: "gap-1.5", seal: "gap-2" };

interface VerdictMarkProps {
  verdict: Verdict;
  /** Optional — when provided, distinguishes a verdict driven by a real finding from one driven by missing data alone (see getVerdictBasis). Omit for contexts with no flags in scope (e.g. an aggregate count); the mark falls back to the verdict's plain shape. */
  flags?: Flag[];
  size?: MarkSize;
  /**
   * Caller's preference. NOT honored when it would render caution/blocked
   * icon-only below "seal" size — see COMPACT_ICON_SAFE_SHAPES. This is a
   * structural rule, not a convention: the override happens here, once, so
   * no call site can accidentally ship an unreadable compact chip.
   */
  showLabel?: boolean;
  /** Overrides the default clinical-register label (e.g. a patient-facing phrase). */
  label?: string;
  className?: string;
}

export function VerdictMark({ verdict, flags = [], size = "badge", showLabel = true, label: labelOverride, className }: VerdictMarkProps) {
  const basis = getVerdictBasis(verdict, flags);
  const shape = getVerdictShape(verdict, basis);
  const tone = getVerdictColorToken(verdict, basis);
  const Shape = SHAPE_COMPONENT[shape];
  const label = labelOverride ?? VERDICT_LABEL[verdict];

  const iconOnlyAllowed = COMPACT_ICON_SAFE_SHAPES.has(shape) || size === "seal";
  let effectiveShowLabel = showLabel;
  if (!showLabel && !iconOnlyAllowed) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `VerdictMark: showLabel=false was ignored for verdict="${verdict}" at size="${size}" — the ${shape} shape isn't reliably legible icon-only below "seal" size (confirmed via colorblindness simulation). Text is mandatory here; this isn't a convention to remember per call site, it's enforced in the component.`
      );
    }
    effectiveShowLabel = true;
  }

  // A "mixed" basis (real finding + unknown data both present) keeps the
  // real shape as primary, but gets a small secondary ring so "there's also
  // something we couldn't verify" isn't lost — skipped at chip size, where
  // there's no room for it without crowding the primary shape.
  const showMixedMark = basis === "mixed" && size !== "chip";

  return (
    <span
      role="status"
      aria-label={`Verdict: ${label}${basis === "mixed" ? " — includes unverified data" : basis === "unknown-only" ? " (unverified data, not a confirmed finding)" : ""}`}
      className={cn("inline-flex items-center", GAP_CLASS[size], className)}
    >
      <span className="relative inline-flex shrink-0">
        <Shape size={ICON_PX[size]} color={TONE_VAR[tone]} />
        {showMixedMark && (
          <span
            className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface"
            style={{ padding: 1 }}
          >
            <UnknownRing size={Math.round(ICON_PX[size] * 0.5)} color="var(--unknown-fg)" />
          </span>
        )}
      </span>
      {effectiveShowLabel && (
        <span className={cn("font-semibold", TEXT_CLASS[size], TONE_TEXT_CLASS[tone])}>{label}</span>
      )}
    </span>
  );
}
