import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-brand text-white shadow-glow hover:brightness-110 active:scale-[0.98] disabled:bg-none disabled:bg-muted disabled:text-subtle disabled:shadow-none",
  secondary:
    "bg-surface text-secondary border border-border-strong hover:bg-surface-2 hover:border-border-strong active:scale-[0.98] disabled:text-subtle disabled:bg-muted",
  ghost:
    "bg-transparent text-secondary hover:bg-muted hover:text-foreground active:scale-[0.98] disabled:text-subtle",
  destructive:
    "bg-blocked-fg text-white shadow-soft hover:brightness-110 active:scale-[0.98] disabled:bg-muted disabled:text-subtle disabled:shadow-none",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:active:scale-100 disabled:brightness-100",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
