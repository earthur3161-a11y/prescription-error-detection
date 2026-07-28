"use client";

import { Select } from "@/components/ui/Select";
import type { ReportingRange } from "@/lib/data/repositories/reportingRepository";

export const REPORTING_RANGE_PRESETS = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
] as const;

export type ReportingRangePreset = (typeof REPORTING_RANGE_PRESETS)[number]["key"];

export function presetToRange(preset: ReportingRangePreset): ReportingRange {
  const days = REPORTING_RANGE_PRESETS.find((p) => p.key === preset)?.days ?? 30;
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function ReportingRangeSelect({
  value,
  onChange,
}: {
  value: ReportingRangePreset;
  onChange: (preset: ReportingRangePreset) => void;
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as ReportingRangePreset)}
      aria-label="Date range"
      className="max-w-[160px]"
    >
      {REPORTING_RANGE_PRESETS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </Select>
  );
}
