import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RouteFadeIn } from "../RouteFadeIn";

let mockPathname = "/check";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

afterEach(() => {
  cleanup();
  mockPathname = "/check";
});

// Regression test for the one genuinely new piece introduced by the
// Patient Self-Check animation pass: app/check/layout.tsx is a server
// component (it exports `metadata`), so it can't call usePathname() itself
// the way app/(app)/layout.tsx's Shell does to replay its page-transition
// fade on navigation. RouteFadeIn exists to bridge that — it must actually
// remount (not just re-render) when the pathname changes, or the CSS
// entrance animation won't replay.
describe("RouteFadeIn", () => {
  it("remounts its wrapper (new DOM node) when the pathname changes, so the entrance animation replays", () => {
    const { container, rerender } = render(
      <RouteFadeIn>
        <p>content</p>
      </RouteFadeIn>
    );
    const firstNode = container.firstElementChild;

    // Same pathname, different render — same DOM node, no remount.
    rerender(
      <RouteFadeIn>
        <p>content</p>
      </RouteFadeIn>
    );
    expect(container.firstElementChild).toBe(firstNode);

    // Pathname changes — a genuinely new DOM node, so the animation replays.
    mockPathname = "/check/history";
    rerender(
      <RouteFadeIn>
        <p>content</p>
      </RouteFadeIn>
    );
    expect(container.firstElementChild).not.toBe(firstNode);
  });

  it("applies the animate-fade-in entrance class", () => {
    const { container } = render(
      <RouteFadeIn>
        <p>content</p>
      </RouteFadeIn>
    );
    expect(container.firstElementChild?.className).toMatch(/animate-fade-in/);
  });
});
