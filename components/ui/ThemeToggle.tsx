"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/useTheme";
import { cn } from "@/lib/utils/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle, mounted } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative grid size-9 place-items-center rounded-xl border border-border text-secondary",
        "transition-all duration-200 hover:border-border-strong hover:text-foreground hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        className
      )}
    >
      {/* Both icons are rendered; the active one animates in. Avoids layout shift and hydration mismatch. */}
      <Sun
        className={cn(
          "absolute size-[18px] transition-all duration-300",
          mounted && !isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
        )}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          "absolute size-[18px] transition-all duration-300",
          mounted && isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        )}
        aria-hidden="true"
      />
    </button>
  );
}
