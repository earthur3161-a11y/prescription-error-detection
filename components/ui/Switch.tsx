import { cn } from "@/lib/utils/cn";

type SwitchTone = "brand" | "caution";
type SwitchSize = "sm" | "md";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: SwitchSize;
  tone?: SwitchTone;
  className?: string;
  "aria-label"?: string;
}

const toneOnClasses: Record<SwitchTone, string> = {
  brand: "bg-brand",
  caution: "bg-caution-fg",
};

const trackSizeClasses: Record<SwitchSize, string> = {
  sm: "h-5 w-9",
  md: "h-7 w-12",
};

const thumbSizeClasses: Record<SwitchSize, string> = {
  sm: "size-3.5",
  md: "size-5",
};

const thumbTranslateClasses: Record<SwitchSize, { on: string; off: string }> = {
  sm: { on: "translate-x-4", off: "translate-x-1" },
  md: { on: "translate-x-6", off: "translate-x-1" },
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  size = "md",
  tone = "brand",
  className,
  "aria-label": ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative shrink-0 rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        trackSizeClasses[size],
        checked ? toneOnClasses[tone] : "bg-muted",
        className
      )}
    >
      <span
        className={cn(
          "absolute top-1 rounded-full bg-surface shadow-soft transition-transform",
          thumbSizeClasses[size],
          checked ? thumbTranslateClasses[size].on : thumbTranslateClasses[size].off
        )}
      />
    </button>
  );
}
