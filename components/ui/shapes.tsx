// The verdict shape language: four distinct silhouettes, not four colors of
// the same badge. Each is legible in grayscale/colorblind simulation on
// shape alone — color is the second, not the only, channel. See
// lib/design/verdictVisuals.ts for which verdict/severity maps to which
// shape, and why unknown never reuses the same closed silhouette as safe.

interface ShapeProps {
  size: number;
  color: string;
  className?: string;
}

/** Safe — a closed, filled seal. The only shape reserved for a fully, genuinely resolved state. */
export function SafeSeal({ size, color, className }: ShapeProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill={color} />
      <path d="M7 12.5l3.2 3.2L17 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Caution — filled triangle, rounded corners. Real, confirmed finding at minor/moderate severity. */
export function CautionTriangle({ size, color, className }: ShapeProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2.2c.5 0 1 .28 1.27.76l9 16.2A1.45 1.45 0 0 1 21 21.4H3a1.45 1.45 0 0 1-1.27-2.24l9-16.2A1.46 1.46 0 0 1 12 2.2Z"
        fill={color}
      />
      <rect x="11" y="9" width="2" height="6" rx="1" fill="white" />
      <circle cx="12" cy="17.3" r="1.15" fill="white" />
    </svg>
  );
}

/** Blocked — filled regular octagon, the stop-sign shape. Real, confirmed finding at major/severe severity; unknown-severity alone never floors a verdict this far. */
export function BlockedOctagon({ size, color, className }: ShapeProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M7.5 2h9L21 6.5v9L16.5 20h-9L3 15.5v-9L7.5 2Z" fill={color} />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="white" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  );
}

/** Unknown — an OPEN, dashed ring: the seal that hasn't been stamped. Never a fourth solid color; its incompleteness IS the signal, so it can't be represented by a filled shape at all. */
export function UnknownRing({ size, color, className }: ShapeProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke={color} strokeWidth="2.4" strokeDasharray="4.2 3.6" strokeLinecap="round" />
      <text x="12" y="16.2" textAnchor="middle" fontSize="11" fontWeight="700" fill={color} fontFamily="ui-sans-serif, system-ui, sans-serif">
        ?
      </text>
    </svg>
  );
}

/** Neutral — a small plain dot, for informational (severity "none") content that isn't part of the verdict language at all. Lowest emphasis on purpose. */
export function NeutralDot({ size, color, className }: ShapeProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill={color} />
    </svg>
  );
}

export const SHAPE_COMPONENT = {
  seal: SafeSeal,
  triangle: CautionTriangle,
  octagon: BlockedOctagon,
  ring: UnknownRing,
  dot: NeutralDot,
} as const;
