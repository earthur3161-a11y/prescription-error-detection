import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
let mockRole: string | null = null;
let mockSubscription: { isLoading: boolean; data?: { isActive: boolean } } = { isLoading: false, data: undefined };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: mockRole, hasHydrated: true }),
}));

vi.mock("@/lib/query/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => mockSubscription,
}));

const { default: Home } = await import("../page");

afterEach(() => {
  cleanup();
  replace.mockClear();
});

// Regression test: app/page.tsx used to redirect any signed-in user straight
// to ROLE_HOME_ROUTE unconditionally, which SubscriptionGuard then bounced
// back to /billing for an unsubscribed prescriber/pharmacist — making
// /billing's "return home" link loop back on itself. A signed-in role with
// no active subscription should now be held on the public page instead.
describe("Home page redirect", () => {
  it("holds an unsubscribed, signed-in prescriber on the public page instead of redirecting", () => {
    mockRole = "prescriber";
    mockSubscription = { isLoading: false, data: { isActive: false } };

    render(<Home />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/start my free check/i)).toBeInTheDocument();
  });

  it("still redirects an actively-subscribed prescriber, with no public-page flash", () => {
    mockRole = "prescriber";
    mockSubscription = { isLoading: false, data: { isActive: true } };

    render(<Home />);

    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByText(/start my free check/i)).not.toBeInTheDocument();
  });

  it("does not redirect or render the public page while subscription status is still loading", () => {
    mockRole = "prescriber";
    mockSubscription = { isLoading: true, data: undefined };

    render(<Home />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/start my free check/i)).not.toBeInTheDocument();
  });

  it("redirects a role with no subscription product (e.g. admin) unconditionally, unchanged", () => {
    mockRole = "admin";
    mockSubscription = { isLoading: false, data: undefined };

    render(<Home />);

    expect(replace).toHaveBeenCalledWith("/admin/analytics");
    expect(screen.queryByText(/start my free check/i)).not.toBeInTheDocument();
  });

  it("shows the public page for an anonymous visitor", () => {
    mockRole = null;
    mockSubscription = { isLoading: false, data: undefined };

    render(<Home />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText(/start my free check/i)).toBeInTheDocument();
  });
});
