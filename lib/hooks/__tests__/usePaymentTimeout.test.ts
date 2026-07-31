import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePaymentTimeout } from "../usePaymentTimeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("usePaymentTimeout", () => {
  it("stays false before the timeout elapses", () => {
    const { result } = renderHook(() => usePaymentTimeout(true, 1000));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);
  });

  it("flips true once isPending has stayed true past the timeout", () => {
    const { result } = renderHook(() => usePaymentTimeout(true, 1000));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);
  });

  it("never times out while isPending is false", () => {
    const { result } = renderHook(() => usePaymentTimeout(false, 1000));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(false);
  });

  it("resets to false the moment isPending goes from true to false — a resolved payment (success or failed) clears any stale timeout flag", () => {
    const { result, rerender } = renderHook(({ isPending }) => usePaymentTimeout(isPending, 1000), {
      initialProps: { isPending: true },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);

    rerender({ isPending: false });
    expect(result.current).toBe(false);
  });

  it("gives a fresh attempt its own full timeout window, not the remainder of a previous one", () => {
    // Simulates: first attempt times out, user clicks "Try again" (isPending
    // -> false momentarily), then a new attempt starts (isPending -> true).
    const { result, rerender } = renderHook(({ isPending }) => usePaymentTimeout(isPending, 1000), {
      initialProps: { isPending: true },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);

    rerender({ isPending: false });
    rerender({ isPending: true });
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });
});
