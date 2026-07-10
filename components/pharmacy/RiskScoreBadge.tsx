import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { riskLevel } from "@/lib/screening-engine";
import type { Verdict } from "@/lib/screening-engine";

const META: Record<Verdict, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  safe: { label: "Low risk", className: "bg-safe-bg text-safe-fg border-safe-border", Icon: CheckCircle2 },
  caution: { label: "Moderate risk", className: "bg-caution-bg text-caution-fg border-caution-border", Icon: AlertTriangle },
  blocked: { label: "High risk", className: "bg-blocked-bg text-blocked-fg border-blocked-border", Icon: XCircle },
};

export function RiskScoreBadge({ verdict, size = "md" }: { verdict: Verdict; size?: "sm" | "md" | "lg" }) {
  const { label, className, Icon } = META[verdict];
  const level = riskLevel(verdict);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-semibold",
        size === "lg" ? "px-4 py-2 text-base" : size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
      aria-label={`Risk score: ${level}`}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} aria-hidden="true" />
      {label}
    </span>
  );
}
