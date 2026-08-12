"use client";

import { useEffect, useRef, useState } from "react";

const PULSE_MS = 800; // matches --animate-data-pulse (app/globals.css)

/**
 * True for PULSE_MS whenever `dataUpdatedAt` changes after the first render
 * — skips the initial load, since a page that just mounted is loading for
 * the first time, not "updating." Meant to drive a brief .animate-data-pulse
 * on a list/section so a background refresh (manual refetch, or any future
 * polling) reads as "this just changed" instead of a silent, unannounced
 * content swap.
 */
export function useDataUpdatedPulse(dataUpdatedAt: number): boolean {
  const [pulsing, setPulsing] = useState(false);
  const seen = useRef(false);

  useEffect(() => {
    if (!dataUpdatedAt) return;
    if (!seen.current) {
      seen.current = true;
      return;
    }
    setPulsing(true);
    const timer = setTimeout(() => setPulsing(false), PULSE_MS);
    return () => clearTimeout(timer);
  }, [dataUpdatedAt]);

  return pulsing;
}
