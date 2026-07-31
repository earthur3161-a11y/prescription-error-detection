"use client";

import { useEffect, useState } from "react";

/**
 * True once `isPending` has stayed true for `timeoutMs` without resolving —
 * the "didn't get the prompt / stuck silently" signal for a payment sitting
 * in Mobile Money's own pending state, distinct from a payment the webhook
 * has already confirmed failed (that's immediate, not timeout-driven — see
 * each caller's own explicit `status === "failed"` branch).
 *
 * Shared by the Patient Self-Check pay-as-you-go flow and the Physician/
 * Pharmacy Portal subscription flow, which independently duplicated this
 * exact timer-and-reset logic before — one implementation now, not two
 * drifting copies of the same wait-then-offer-a-retry pattern.
 */
export function usePaymentTimeout(isPending: boolean, timeoutMs: number): boolean {
  const [timedOut, setTimedOut] = useState(false);

  // Reset during render when isPending changes (React's own documented
  // "adjusting state when a prop changes" pattern), not as a synchronous
  // setState at the top of the effect below — a fresh attempt starting, or
  // a resolved one (success/failed) ending, must never carry over a stale
  // timeout flag from the previous isPending value.
  const [prevIsPending, setPrevIsPending] = useState(isPending);
  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending);
    setTimedOut(false);
  }

  // The effect itself only ever arms/clears the actual timer — a legitimate
  // external-system subscription, not a synchronous state adjustment.
  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [isPending, timeoutMs]);

  return timedOut;
}
