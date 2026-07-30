import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "brand" | "safe" | "caution" | "blocked" | "unknown";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-secondary",
  brand: "bg-brand-subtle text-brand",
  safe: "bg-safe-bg text-safe-fg",
  caution: "bg-caution-bg text-caution-fg",
  blocked: "bg-blocked-bg text-blocked-fg",
  unknown: "bg-unknown-bg text-unknown-fg",
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
