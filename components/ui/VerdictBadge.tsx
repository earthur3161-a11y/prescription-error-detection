import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Verdict } from "@/lib/screening-engine";

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const config: Record<
  Verdict,
  { label: string; icon: typeof CheckCircle2; classes: string }
> = {
  safe: {
    label: "Safe",
    icon: CheckCircle2,
    classes: "bg-safe-bg text-safe-fg border-safe-border",
  },
  caution: {
    label: "Caution",
    icon: AlertTriangle,
    classes: "bg-caution-bg text-caution-fg border-caution-border",
  },
  blocked: {
    label: "Blocked",
    icon: XCircle,
    classes: "bg-blocked-bg text-blocked-fg border-blocked-border",
  },
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5 gap-1 [&_svg]:size-3.5",
  md: "text-sm px-3 py-1 gap-1.5 [&_svg]:size-4",
  lg: "text-base px-4 py-1.5 gap-2 [&_svg]:size-5",
};

export function VerdictBadge({ verdict, size = "md", className }: VerdictBadgeProps) {
  const { label, icon: Icon, classes } = config[verdict];
  return (
    <span
      role="status"
      aria-label={`Verdict: ${label}`}
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        classes,
        sizeClasses[size],
        className
      )}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
