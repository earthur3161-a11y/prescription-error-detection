import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replace = vi.fn();
const logout = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: "prescriber", hasHydrated: true, logout }),
}));

vi.mock("@/lib/query/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => ({ isLoading: false, data: { isActive: false, periodEnd: null } }),
  useInitiateSubscriptionPayment: () => ({ mutate: vi.fn(), isPending: false }),
  useSubscriptionPaymentStatus: () => ({ data: undefined }),
}));

const { default: BillingPage } = await import("../page");

afterEach(() => cleanup());

// Regression test: an unsubscribed, still-authenticated user clicking the
// billing page's "home" link used to be sent to "/", which immediately
// redirects any signed-in user to their ROLE_HOME_ROUTE (app/page.tsx) —
// which SubscriptionGuard then bounces straight back to /billing, since
// that's exactly why they landed here. There's no reachable "home" while
// signed in and unsubscribed, so leaving now means actually signing out.
describe("Billing page 'leave' control", () => {
  it("signs the user out and navigates to / instead of looping back through ROLE_HOME_ROUTE", () => {
    render(<BillingPage />);

    screen.getByRole("button", { name: /sign out/i }).click();

    expect(logout).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
