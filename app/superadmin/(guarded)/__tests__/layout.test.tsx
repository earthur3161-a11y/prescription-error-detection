import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/superadmin/activity",
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: "superadmin", hasHydrated: true, logout: vi.fn() }),
}));

const { default: SuperAdminLayout } = await import("../layout");

afterEach(() => cleanup());

// Regression test: "MediGuard Operations" in the header used to be a plain
// <div>, not a link — a dead click on all 3 Super Admin pages.
describe("Super Admin layout header", () => {
  it("links 'MediGuard Operations' to /superadmin (this role's ROLE_HOME_ROUTE)", () => {
    render(
      <SuperAdminLayout>
        <div>content</div>
      </SuperAdminLayout>
    );
    const logoLink = screen.getByRole("link", { name: /mediguard operations/i });
    expect(logoLink).toHaveAttribute("href", "/superadmin");
  });
});
