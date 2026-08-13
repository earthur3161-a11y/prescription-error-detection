"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Notice } from "@/components/ui/Notice";

/**
 * Facility Admin portal is hidden for now (product decision, not a technical
 * removal) — the role, its RLS policies, and every app/(app)/admin/** page
 * are untouched, so this is a one-file, fully reversible change: swap this
 * back for the real PortalLoginForm (see git history) to bring it back.
 */
export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <ShieldCheck className="size-8 text-brand" aria-hidden="true" />
        <span className="text-2xl font-semibold text-foreground">MediGuard</span>
      </Link>
      <div className="w-full max-w-sm space-y-4">
        <Notice tone="neutral" title="Facility Admin portal isn't available right now">
          This portal is temporarily unavailable. If you need institution-level oversight, formulary
          management, or reporting, contact MediGuard support.
        </Notice>
        <Link
          href="/login"
          className="block w-full rounded-xl border border-border-strong px-4 py-2.5 text-center text-sm font-medium text-secondary transition-colors hover:border-brand hover:text-brand"
        >
          Back to portal chooser
        </Link>
      </div>
    </div>
  );
}
