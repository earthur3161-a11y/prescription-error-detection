import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type StepBadgeSize = "sm" | "md";

interface StepBadgeProps {
  step: number | ReactNode;
  size?: StepBadgeSize;
  className?: string;
}

const sizeClasses: Record<StepBadgeSize, string> = {
  sm: "size-5 text-xs",
  md: "size-8 text-sm",
};

export function StepBadge({ step, size = "sm", className }: StepBadgeProps) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-subtle font-semibold text-brand",
        sizeClasses[size],
        className
      )}
    >
      {step}
    </span>
  );
}
