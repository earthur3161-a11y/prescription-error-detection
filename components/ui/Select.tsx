import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "h-11 w-full appearance-none rounded-xl border border-border-strong bg-surface pl-3.5 pr-9 text-sm text-foreground",
            "transition-shadow duration-200",
            "focus:outline-none focus:border-brand focus:ring-2 focus:ring-[var(--ring)]",
            "disabled:bg-muted disabled:text-subtle disabled:cursor-not-allowed",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
        />
      </div>
    );
  }
);
Select.displayName = "Select";
