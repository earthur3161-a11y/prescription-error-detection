"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Input";
import { cn } from "@/lib/utils/cn";

/**
 * The one shared password field, used everywhere a password is typed
 * (signup, login, invite activation). `type` is internally managed by the
 * visibility toggle, so it isn't accepted as a prop — everything else
 * forwards straight to the underlying Input, including autoComplete, so
 * password-manager save/fill prompts behave exactly as they would on a
 * plain masked field. Toggling `type` between "password" and "text" on the
 * same DOM node (not remounting) is the standard, widely-supported pattern
 * for this and doesn't affect autofill; some browsers' own built-in
 * password-manager icon can visually sit close to this button inside the
 * field, which is browser chrome outside this component's control.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        {/* type spread last so it always wins over a stray runtime "type" prop
            (e.g. from an `as any` escape hatch) — Omit<..., "type"> only
            protects this at the type level, not at runtime. */}
        <Input ref={ref} className={cn("pr-11", className)} {...props} type={visible ? "text" : "password"} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-subtle hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
