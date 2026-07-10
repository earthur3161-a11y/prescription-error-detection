"use client";

import { useState } from "react";
import { resetLocalData } from "@/lib/data/db";

/**
 * Route-level error boundary. If a page throws (most likely from a bad local
 * data state), the user gets a clear recovery path instead of a blank/broken
 * page: retry, or wipe the local cache and reload.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [resetting, setResetting] = useState(false);

  async function hardReset() {
    setResetting(true);
    await resetLocalData();
    window.location.href = "/";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">This page hit a problem</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong loading this page. This is usually caused by out-of-date data saved in
          your browser from an earlier version.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={() => reset()}
            className="h-11 rounded-xl bg-brand px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            onClick={hardReset}
            disabled={resetting}
            className="h-11 rounded-xl border border-border-strong px-4 text-sm font-medium text-secondary hover:bg-surface-2 disabled:opacity-60"
          >
            {resetting ? "Resetting…" : "Reset local data & reload"}
          </button>
        </div>
        {error?.message && (
          <p className="mt-4 break-words text-left text-xs text-subtle">Details: {error.message}</p>
        )}
      </div>
    </div>
  );
}
