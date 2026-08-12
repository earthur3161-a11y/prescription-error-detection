import { Card, CardBody } from "@/components/ui/Card";

const valueToneClass: Record<"default" | "safe" | "caution" | "blocked", string> = {
  default: "text-foreground",
  safe: "text-safe-fg",
  caution: "text-caution-fg",
  blocked: "text-blocked-fg",
};

/**
 * Shared KPI tile — Reports and Dashboard both use this so a "flagged rate"
 * reads identically wherever it appears. Padding and type scale step down at
 * the base (mobile) size and widen out from `sm:` — these tiles are meant to
 * sit 2-3 across on a phone screen (see each page's grid), so full desktop
 * padding/text-2xl at that width read as oversized and wasted the row down
 * to one cramped column per line.
 *
 * `min-w-0` on the Card matters more than it looks: a CSS grid item's
 * default min-width is "auto", which floors it at its content's unbroken
 * width — a single long word like "Prescriptions" can't wrap, so at 3
 * columns on a narrow phone the card was forced wider than its actual grid
 * track and visually broke out of its column instead of staying contained.
 * `min-w-0` lets the card shrink to the track width and `break-words` gives
 * the label somewhere to go instead of overflowing when it does.
 */
export function Kpi({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "safe" | "caution" | "blocked";
}) {
  return (
    <Card className="min-w-0">
      <CardBody className="p-3.5 text-center sm:p-5">
        <p className="break-words text-[11px] font-semibold uppercase leading-tight tracking-wide text-subtle sm:text-xs">
          {label}
        </p>
        <p className={`mt-1 break-words text-xl font-semibold tabular-nums sm:text-2xl ${valueToneClass[tone]}`}>
          {value}
        </p>
        {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{sub}</p>}
      </CardBody>
    </Card>
  );
}
