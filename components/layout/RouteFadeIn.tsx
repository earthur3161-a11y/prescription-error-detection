"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Mirrors app/(app)/layout.tsx's inline `key={pathname} animate-fade-in`
 * page-transition wrapper, packaged as its own component so a server layout
 * (e.g. app/check/layout.tsx, which exports `metadata` and can't itself
 * become a client component) can still get the same page-transition fade.
 */
export function RouteFadeIn({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
