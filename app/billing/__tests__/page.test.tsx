import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: "prescriber", hasHydrated: true }),
}));

vi.mock("@/lib/query/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => ({ isLoading: false, data: { isActive: false, periodEnd: null } }),
  useInitiateSubscriptionPayment: () => ({ mutate: vi.fn(), isPending: false }),
  useSubscriptionPaymentStatus: () => ({ data: undefined }),
}));

const { default: BillingPage } = await import("../page");

afterEach(() => cleanup());

// Regression test: this used to be a plain link to "/", which immediately
// redirects any signed-in user to their ROLE_HOME_ROUTE (app/page.tsx) —
// which SubscriptionGuard then bounced straight back to /billing, since
// that's exactly why they landed here. app/page.tsx now holds a signed-in,
// unsubscribed professional on the public page instead of redirecting them
// away, so a plain link is enough — verified here by asserting the href.
describe("Billing page 'return home' link", () => {
  it("links to / (app/page.tsx is responsible for not looping this back)", () => {
    render(<BillingPage />);

    const homeLink = screen.getByRole("link", { name: /return home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });
});
