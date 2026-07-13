import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-foreground",
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
Textarea.displayName = "Textarea";
