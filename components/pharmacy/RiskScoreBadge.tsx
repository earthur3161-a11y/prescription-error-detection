import { cn } from "@/lib/utils/cn";
import {
  TONE_TEXT_CLASS,
  TONE_VAR,
  getVerdictBasis,
  getVerdictColorToken,
  getVerdictShape,
  type VerdictBasis,
} from "@/lib/design/verdictVisuals";
import { SHAPE_COMPONENT } from "@/components/ui/shapes";
import type { Flag, Verdict } from "@/lib/screening-engine";

// "Risk" framing over the same shared verdict language everywhere else in
// the app uses — a confirmed caution IS a moderate risk, but an
// unknown-only one isn't a risk finding at all, just an open question, so
// it gets its own label rather than borrowing "Moderate risk" for
// something no risk was actually confirmed on. blocked can never be
// unknown-only (severity=unknown alone never floors a verdict that far),
// so that combination is unreachable, not just unused.
const RISK_LABEL: Record<VerdictBasis, Record<Verdict, string>> = {
  confirmed: { safe: "Low risk", caution: "Moderate risk", blocked: "High risk" },
  "unknown-only": { safe: "Low risk", caution: "Unverified — not a confirmed risk", blocked: "Unverified — not a confirmed risk" },
  mixed: { safe: "Low risk", caution: "Moderate risk — some data also unverified", blocked: "High risk — some data also unverified" },
};

const BORDER_CLASS: Record<ReturnType<typeof getVerdictColorToken>, string> = {
  safe: "border-safe-border",
  caution: "border-caution-border",
  blocked: "border-blocked-border",
  unknown: "border-unknown-border",
  neutral: "border-border",
};
const BG_CLASS: Record<ReturnType<typeof getVerdictColorToken>, string> = {
  safe: "bg-safe-bg",
  caution: "bg-caution-bg",
  blocked: "bg-blocked-bg",
  unknown: "bg-unknown-bg",
  neutral: "bg-muted",
};

interface RiskScoreBadgeProps {
  verdict: Verdict;
  /** Optional — enables the unverified-vs-confirmed distinction above. Omitted call sites fall back to the plain verdict-driven label. */
  flags?: Flag[];
  size?: "sm" | "md" | "lg";
}

export function RiskScoreBadge({ verdict, flags = [], size = "md" }: RiskScoreBadgeProps) {
  const basis = getVerdictBasis(verdict, flags);
  const tone = getVerdictColorToken(verdict, basis);
  const Shape = SHAPE_COMPONENT[getVerdictShape(verdict, basis)];
  const label = RISK_LABEL[basis][verdict];
  const iconPx = size === "lg" ? 22 : size === "sm" ? 14 : 18;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold",
        size === "lg" ? "px-4 py-2 text-base" : size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        BG_CLASS[tone],
        BORDER_CLASS[tone],
        TONE_TEXT_CLASS[tone]
      )}
      aria-label={`Risk: ${label}`}
    >
      <Shape size={iconPx} color={TONE_VAR[tone]} />
      {label}
    </span>
  );
}
