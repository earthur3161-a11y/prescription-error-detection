import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ToastViewport } from "../Toast";
import { useToastStore } from "@/lib/store/toast-store";

afterEach(() => {
  cleanup();
  useToastStore.setState({ toasts: [] });
});

// Regression test: the dismiss button had no sizing classes at all (~16px
// hit target) — the hit area is expanded via negative-margin padding rather
// than growing the button visually, so the toast doesn't get taller.
describe("Toast dismiss button", () => {
  it("expands the dismiss button's hit area without growing it visually", () => {
    act(() => {
      useToastStore.getState().show({ title: "Saved", variant: "success" });
    });
    render(<ToastViewport />);

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    expect(dismissButton.className).toMatch(/-m-2\.5/);
    expect(dismissButton.className).toMatch(/p-2\.5/);
  });
});

// Regression test: dismissing a toast (manual click or the 4500ms
// auto-timeout) used to filter it out of the array immediately — an
// instant cut, never actually playing the entrance's mirror exit
// animation. dismiss() now marks `leaving` first and only removes the
// toast after the exit animation's own duration.
describe("Toast exit animation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("switches to the exit animation class immediately, then removes the toast after the exit duration", () => {
    act(() => {
      useToastStore.getState().show({ title: "Saved", variant: "success" });
    });
    // show() doesn't return the id — read it back from state instead.
    const id = useToastStore.getState().toasts[0].id;
    render(<ToastViewport />);

    expect(screen.getByText("Saved").closest('[role="status"]')?.className).toMatch(/animate-fade-up/);

    act(() => {
      useToastStore.getState().dismiss(id);
    });
    expect(screen.getByText("Saved").closest('[role="status"]')?.className).toMatch(/animate-fade-out/);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("the 4500ms auto-dismiss also plays the exit animation rather than cutting instantly", () => {
    act(() => {
      useToastStore.getState().show({ title: "Auto", variant: "default" });
    });
    render(<ToastViewport />);

    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(screen.getByText("Auto").closest('[role="status"]')?.className).toMatch(/animate-fade-out/);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
