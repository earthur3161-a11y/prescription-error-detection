import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useDataUpdatedPulse } from "../useDataUpdatedPulse";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useDataUpdatedPulse", () => {
  it("stays false on first mount — a page loading for the first time isn't 'updating'", () => {
    const { result } = renderHook(() => useDataUpdatedPulse(1000));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
  });

  it("stays false while dataUpdatedAt is still 0 (query hasn't resolved yet)", () => {
    const { result, rerender } = renderHook(({ t }) => useDataUpdatedPulse(t), { initialProps: { t: 0 } });
    expect(result.current).toBe(false);
    rerender({ t: 0 });
    expect(result.current).toBe(false);
  });

  it("pulses true when dataUpdatedAt changes after the initial value, then clears after 800ms", () => {
    const { result, rerender } = renderHook(({ t }) => useDataUpdatedPulse(t), { initialProps: { t: 1000 } });
    expect(result.current).toBe(false);

    rerender({ t: 2000 });
    expect(result.current).toBe(true);

    act(() => vi.advanceTimersByTime(799));
    expect(result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });

  it("re-arms for a second update — not a one-shot flag", () => {
    const { result, rerender } = renderHook(({ t }) => useDataUpdatedPulse(t), { initialProps: { t: 1000 } });
    rerender({ t: 2000 });
    act(() => vi.advanceTimersByTime(800));
    expect(result.current).toBe(false);

    rerender({ t: 3000 });
    expect(result.current).toBe(true);
  });
});
