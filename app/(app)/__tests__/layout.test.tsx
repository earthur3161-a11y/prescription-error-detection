import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: "prescriber" }),
}));

vi.mock("@/components/layout/RoleGuard", () => ({
  RoleGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/SubscriptionGuard", () => ({
  SubscriptionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/Topbar", () => ({
  Topbar: ({ onMenuClick }: { onMenuClick: () => void }) => (
    <button onClick={onMenuClick}>open menu</button>
  ),
}));

const { default: AppLayout } = await import("../layout");

afterEach(() => cleanup());

// Regression test: the mobile drawer used to be conditionally mounted, so
// closing it was an instant cut with no time to play any exit transition.
// It's now always mounted and toggles transform/opacity classes instead, so
// both open and close can actually animate.
describe("Mobile nav drawer", () => {
  it("is off-screen and inert by default, then slides in and becomes interactive when opened", () => {
    render(
      <AppLayout>
        <div>page content</div>
      </AppLayout>
    );

    const closeButton = screen.getByRole("button", { name: /close navigation menu/i });
    const panel = closeButton.parentElement as HTMLElement;
    const wrapper = panel.parentElement as HTMLElement;

    expect(panel.className).toMatch(/-translate-x-full/);
    expect(wrapper.getAttribute("inert")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /open menu/i }));

    expect(panel.className).toMatch(/translate-x-0/);
    expect(wrapper.getAttribute("inert")).toBeNull();
  });
});
