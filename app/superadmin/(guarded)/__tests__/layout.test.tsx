import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const replaceMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/superadmin/activity",
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: "superadmin", hasHydrated: true, logout: logoutMock }),
}));

const { default: SuperAdminLayout } = await import("../layout");

afterEach(() => {
  cleanup();
  replaceMock.mockClear();
  logoutMock.mockClear();
});

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

// Systemwide auth audit: confirms the sign-out control actually signs out.
describe("Super Admin layout sign-out", () => {
  it("calls logout() and navigates to /superadmin/login when clicked", () => {
    render(
      <SuperAdminLayout>
        <div>content</div>
      </SuperAdminLayout>
    );

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/superadmin/login");
  });
});
