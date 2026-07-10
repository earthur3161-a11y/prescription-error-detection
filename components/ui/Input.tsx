import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-foreground",
          "placeholder:text-subtle transition-shadow duration-200",
          "focus:outline-none focus:border-brand focus:ring-2 focus:ring-[var(--ring)]",
          "disabled:bg-muted disabled:text-subtle disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
