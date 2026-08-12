import { Card, CardBody } from "@/components/ui/Card";

const valueToneClass: Record<"default" | "safe" | "caution" | "blocked", string> = {
  default: "text-foreground",
  safe: "text-safe-fg",
  caution: "text-caution-fg",
  blocked: "text-blocked-fg",
};

/** Shared KPI tile — Reports and Dashboard both use this so a "flagged rate" reads identically wherever it appears. */
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
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueToneClass[tone]}`}>{value}</p>
        {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
      </CardBody>
    </Card>
  );
}
