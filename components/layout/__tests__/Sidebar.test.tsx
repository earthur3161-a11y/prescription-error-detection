import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import { ROLE_HOME_ROUTE } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/some/current/page",
}));

afterEach(() => cleanup());

describe("Sidebar", () => {
  // Regression test: the MediGuard logo used to be a plain <div> with no
  // href at all — a dead click on every one of the ~25 pages this shell
  // wraps, for all three professional roles.
  it.each<UserRole>(["prescriber", "pharmacist", "admin"])(
    "links the MediGuard logo to %s's own ROLE_HOME_ROUTE",
    (role) => {
      render(<Sidebar role={role} />);
      const logoLink = screen.getByRole("link", { name: /mediguard/i });
      expect(logoLink).toHaveAttribute("href", ROLE_HOME_ROUTE[role]);
    }
  );

  it("puts pharmacist's home route (Inventory) first in the nav list, matching Prescriber's Dashboard and Admin's Facility Analytics already leading theirs", () => {
    render(<Sidebar role="pharmacist" />);
    const links = screen.getAllByRole("link");
    // First link is the logo itself; the first nav item follows it.
    expect(links[1]).toHaveAttribute("href", "/pharmacist/inventory");
    expect(links[1]).toHaveTextContent("Inventory");
  });

  it("still leads with Dashboard for prescriber and Facility Analytics for admin (unchanged ordering)", () => {
    const { unmount } = render(<Sidebar role="prescriber" />);
    expect(screen.getAllByRole("link")[1]).toHaveAttribute("href", "/dashboard");
    unmount();

    render(<Sidebar role="admin" />);
    expect(screen.getAllByRole("link")[1]).toHaveAttribute("href", "/admin/analytics");
  });

  it("calls onNavigate when the logo is clicked, same as any other nav link (closes the mobile menu overlay)", () => {
    const onNavigate = vi.fn();
    render(<Sidebar role="prescriber" onNavigate={onNavigate} />);
    screen.getByRole("link", { name: /mediguard/i }).click();
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
