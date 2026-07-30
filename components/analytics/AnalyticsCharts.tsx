"use client";

import type { DailyPoint, LabeledCount } from "@/lib/analytics/facilityMetrics";

// The actual verdict-palette CSS custom properties (globals.css), not
// hardcoded hex — these previously duplicated the palette as literal hex
// (including a plain blue "brand" that never matched --brand's graphite
// charcoal), which silently didn't shift with the light/dark theme the way
// every other verdict-colored element in the app does. var(--x) here means
// these charts now repaint correctly on theme toggle like everything else.
export const CHART_COLORS = {
  safe: "var(--safe-fg)",
  caution: "var(--caution-fg)",
  blocked: "var(--blocked-fg)",
  unknown: "var(--unknown-fg)",
  brand: "var(--brand)",
} as const;

function formatDayLabel(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A single horizontal stacked bar (e.g. overall verdict mix) with a legend. */
export function SegmentBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribution">
        {total > 0 &&
          segments.map((seg) => (
            <div
              key={seg.label}
              style={{ width: `${(seg.value / total) * 100}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${seg.value}`}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden="true" />
            <span className="text-secondary">{seg.label}</span>
            <span className="font-medium tabular-nums text-foreground">{seg.value}</span>
            <span className="tabular-nums text-subtle">
              ({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Labeled horizontal bars for ranked counts (flag types, top drugs, pharmacist actions). */
export function BarList({
  items,
  color = CHART_COLORS.brand,
  emptyLabel = "No data yet.",
}: {
  items: LabeledCount[];
  color?: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-subtle">{emptyLabel}</p>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-3">
          <span className="w-40 shrink-0 truncate text-sm text-secondary" title={item.label}>
            {item.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.count / max) * 100}%`, backgroundColor: color }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** Daily stacked bars (safe/caution/blocked) over the data's date range. */
export function StackedDailyChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) return <p className="text-sm text-subtle">No screenings recorded yet.</p>;
  const maxTotal = Math.max(...data.map((d) => d.safe + d.caution + d.blocked), 1);

  const labelEvery = Math.ceil(data.length / 6); // keep the x-axis readable

  return (
    <div>
      <div className="flex h-44 items-end gap-1" role="img" aria-label="Daily screening volume by verdict">
        {data.map((d) => {
          const total = d.safe + d.caution + d.blocked;
          const pct = (n: number) => (n / maxTotal) * 100;
          return (
            <div
              key={d.date}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${formatDayLabel(d.date)} — ${total} screening${total === 1 ? "" : "s"} (safe ${d.safe}, caution ${d.caution}, blocked ${d.blocked})`}
            >
              {d.blocked > 0 && (
                <div style={{ height: `${pct(d.blocked)}%`, backgroundColor: CHART_COLORS.blocked }} />
              )}
              {d.caution > 0 && (
                <div style={{ height: `${pct(d.caution)}%`, backgroundColor: CHART_COLORS.caution }} />
              )}
              {d.safe > 0 && (
                <div
                  className="rounded-t-sm"
                  style={{ height: `${pct(d.safe)}%`, backgroundColor: CHART_COLORS.safe }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 text-center text-[10px] text-subtle">
            {i % labelEvery === 0 ? formatDayLabel(d.date) : ""}
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {[
          { label: "Safe", color: CHART_COLORS.safe },
          { label: "Caution", color: CHART_COLORS.caution },
          { label: "Blocked", color: CHART_COLORS.blocked },
        ].map((s) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            <span className="text-secondary">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
