import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replaceMock = vi.fn();
let mockAuth: { role: string | null; isAuthenticated: boolean; hasHydrated: boolean } = {
  role: null,
  isAuthenticated: false,
  hasHydrated: true,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => mockAuth,
}));

const { RoleGuard } = await import("../RoleGuard");

afterEach(() => {
  cleanup();
  replaceMock.mockClear();
});

// Regression coverage for the systemwide auth audit: confirms RoleGuard's
// three real branches (still hydrating, wrong/no role, correct role) each
// do exactly what they claim, since every professional page in the app
// depends on this one component for access control.
describe("RoleGuard", () => {
  it("shows nothing but doesn't redirect while still hydrating", () => {
    mockAuth = { role: null, isAuthenticated: false, hasHydrated: false };
    render(
      <RoleGuard allowedRoles={["prescriber"]}>
        <p>secret content</p>
      </RoleGuard>
    );

    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("redirects an unauthenticated visitor to /login and renders nothing", () => {
    mockAuth = { role: null, isAuthenticated: false, hasHydrated: true };
    render(
      <RoleGuard allowedRoles={["prescriber"]}>
        <p>secret content</p>
      </RoleGuard>
    );

    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("redirects a signed-in but wrong-role user to their OWN home route, not /login", () => {
    mockAuth = { role: "pharmacist", isAuthenticated: true, hasHydrated: true };
    render(
      <RoleGuard allowedRoles={["prescriber"]}>
        <p>secret content</p>
      </RoleGuard>
    );

    expect(replaceMock).toHaveBeenCalledWith("/pharmacist/inventory");
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("renders children for a correctly-authorized role, with no redirect", () => {
    mockAuth = { role: "prescriber", isAuthenticated: true, hasHydrated: true };
    render(
      <RoleGuard allowedRoles={["prescriber"]}>
        <p>secret content</p>
      </RoleGuard>
    );

    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });

  it("with no allowedRoles restriction, any authenticated role passes through (e.g. Super Admin's own guard)", () => {
    mockAuth = { role: "superadmin", isAuthenticated: true, hasHydrated: true };
    render(
      <RoleGuard>
        <p>secret content</p>
      </RoleGuard>
    );

    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByText("secret content")).toBeInTheDocument();
  });
});
