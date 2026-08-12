import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Modal } from "../Modal";

// Regression test: closing a modal used to be an instant unmount with no
// exit animation — Radix Dialog supports data-[state=closed] variants
// natively, but nothing wired them up. This asserts the classes stay
// present, since the actual animation-then-unmount timing depends on a
// real animationend event jsdom doesn't fire.
describe("Modal", () => {
  it("carries both entrance and exit animation classes on the overlay and content", () => {
    render(
      <Modal open title="Test modal" onOpenChange={() => {}}>
        <p>Body</p>
      </Modal>
    );

    const content = screen.getByRole("dialog");
    expect(content.className).toMatch(/animate-scale-in/);
    expect(content.className).toMatch(/data-\[state=closed\]:animate-scale-out/);

    const overlay = document.querySelector('[class*="animate-fade-in"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toMatch(/data-\[state=closed\]:animate-fade-out/);
  });
});
