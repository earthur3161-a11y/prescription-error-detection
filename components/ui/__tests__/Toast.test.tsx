import { afterEach, describe, expect, it } from "vitest";
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
