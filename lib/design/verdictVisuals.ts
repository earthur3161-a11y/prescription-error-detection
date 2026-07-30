// Single source of truth for how a Verdict/Severity renders — replaces four
// independently-drifted mappings that used to live in VerdictBadge.tsx,
// flagPresentation.ts, ResultView.tsx, and FindingsPanel.tsx. Pure data/logic
// only (no JSX) so it's trivially unit-testable and framework-agnostic.
//
// Presentation-layer only: reads Verdict/Flag/Severity, never computes or
// alters them. The screening engine's own verdict/severity determination is
// untouched.

import type { Flag, Severity, Verdict } from "../screening-engine";

export type MarkShape = "seal" | "triangle" | "octagon" | "ring" | "dot";
export type VerdictColorToken = "safe" | "caution" | "blocked" | "unknown" | "neutral";

/**
 * Whether a caution/blocked verdict is driven by a real, confirmed finding,
 * by missing data alone, or both. Derived entirely from the flags already on
 * the verdict — the engine's own verdict value never distinguishes this, so
 * without this, a physician glancing at a caution triangle can't tell "a
 * real interaction was found" from "we don't have your renal status" without
 * expanding the flag list. `safe` is always "confirmed" — it can't carry an
 * unknown-severity flag by construction (unknown floors the verdict to at
 * least caution).
 */
export type VerdictBasis = "confirmed" | "unknown-only" | "mixed";

export function getVerdictBasis(verdict: Verdict, flags: Flag[] = []): VerdictBasis {
  if (verdict === "safe") return "confirmed";
  const relevant = flags.filter((f) => f.severity !== "none");
  const hasReal = relevant.some((f) => f.severity !== "unknown");
  const hasUnknown = relevant.some((f) => f.severity === "unknown");
  if (hasUnknown && !hasReal) return "unknown-only";
  if (hasUnknown && hasReal) return "mixed";
  return "confirmed";
}

/** True whenever ANY flag on this verdict is unknown-severity, regardless of basis — drives the small secondary "unknown contributed" mark on a mixed caution/blocked. */
export function hasUnknownContribution(flags: Flag[] = []): boolean {
  return flags.some((f) => f.severity === "unknown");
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  safe: "Safe",
  caution: "Caution",
  blocked: "Blocked",
};

/** The shape actually rendered for a verdict, accounting for basis: an
 * unknown-only caution shows the open ring (nothing was confirmed wrong —
 * something just couldn't be checked), never the solid triangle. A mixed
 * caution/blocked keeps its real shape; the unknown contribution becomes a
 * small secondary mark instead of replacing the primary one. */
export function getVerdictShape(verdict: Verdict, basis: VerdictBasis): MarkShape {
  if (verdict === "safe") return "seal";
  if (verdict === "caution") return basis === "unknown-only" ? "ring" : "triangle";
  return "octagon"; // blocked — always a real, confirmed finding (unknown alone never floors this far)
}

export function getVerdictColorToken(verdict: Verdict, basis: VerdictBasis): VerdictColorToken {
  if (verdict === "safe") return "safe";
  if (verdict === "caution") return basis === "unknown-only" ? "unknown" : "caution";
  return "blocked";
}

// --- Flag-severity level (more granular than Verdict — used in findings lists) ---

export const SEVERITY_SHAPE: Record<Severity, MarkShape> = {
  none: "dot",
  minor: "triangle",
  moderate: "triangle",
  major: "octagon",
  severe: "octagon",
  unknown: "ring",
};

export const SEVERITY_COLOR_TOKEN: Record<Severity, VerdictColorToken> = {
  none: "neutral",
  minor: "caution",
  moderate: "caution",
  major: "blocked",
  severe: "blocked",
  unknown: "unknown",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  none: "Note",
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  severe: "Severe",
  unknown: "Unknown",
};

/**
 * Shapes that read reliably at a real compact-chip size (~14-20px) without
 * text. Triangle and octagon do NOT qualify — confirmed via a rendered
 * deuteranopia simulation that the caution/blocked color pair sits at a
 * borderline ΔE (~19) under that condition, and the shape silhouettes alone
 * aren't crisp enough at 14px to fully carry the distinction. Seal and ring
 * (safe/unknown) have enough of a color margin and a strong enough shape
 * contrast (filled disc vs. open dashed ring) to stand alone compact.
 * FlagSeverityChip and VerdictMark both consult this — neither exposes an
 * icon-only compact variant for a shape that isn't in this set, so the rule
 * lives in one place, not per call site.
 */
export const COMPACT_ICON_SAFE_SHAPES: ReadonlySet<MarkShape> = new Set(["seal", "ring", "dot"]);

// Tailwind's JIT scanner needs every class name literal in source — a
// template-interpolated `border-l-${tone}-fg` silently produces no CSS for
// any combination not ALSO spelled out somewhere else. Centralizing the
// literal strings here (once) instead of duplicating this map per
// component is what actually avoids that trap, not per-file vigilance.
export const TONE_TEXT_CLASS: Record<VerdictColorToken, string> = {
  safe: "text-safe-fg",
  caution: "text-caution-fg",
  blocked: "text-blocked-fg",
  unknown: "text-unknown-fg",
  neutral: "text-muted-foreground",
};
export const TONE_VAR: Record<VerdictColorToken, string> = {
  safe: "var(--safe-fg)",
  caution: "var(--caution-fg)",
  blocked: "var(--blocked-fg)",
  unknown: "var(--unknown-fg)",
  neutral: "var(--muted-foreground)",
};
export const TONE_BG_CLASS: Record<VerdictColorToken, string> = {
  safe: "bg-safe-bg",
  caution: "bg-caution-bg",
  blocked: "bg-blocked-bg",
  unknown: "bg-unknown-bg",
  neutral: "bg-muted",
};
export const TONE_BORDER_L_CLASS: Record<VerdictColorToken, string> = {
  safe: "border-l-4 border-l-safe-fg",
  caution: "border-l-4 border-l-caution-fg",
  blocked: "border-l-4 border-l-blocked-fg",
  unknown: "border-l-4 border-l-unknown-fg",
  neutral: "border-l-4 border-l-border-strong",
};
