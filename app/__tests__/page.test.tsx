import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { installMemoryLocalStorage } from "@/vitest-stubs/memoryLocalStorage";

beforeAll(() => {
  installMemoryLocalStorage();
});

const replace = vi.fn();
let mockRole: string | null = null;
let mockSubscription: { isLoading: boolean; data?: { isActive: boolean } } = { isLoading: false, data: undefined };
let mockQuota: { isLoading: boolean; data?: { freeRemaining: number; paidAvailable: number; phoneVerified: boolean } } = {
  isLoading: false,
  data: undefined,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: mockRole, hasHydrated: true }),
}));

vi.mock("@/lib/query/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => mockSubscription,
}));

// Real getLastCheckPhone() runs against jsdom's real localStorage (see
// SignInStep.test.tsx for the same choice) — only the quota lookup itself
// needs mocking, since useCheckQuota wraps a real TanStack Query useQuery
// call this test file has no QueryClientProvider for.
vi.mock("@/lib/query/hooks/useCheckQuota", () => ({
  useCheckQuota: () => mockQuota,
}));

const { default: Home } = await import("../page");

afterEach(() => {
  cleanup();
  replace.mockClear();
  mockQuota = { isLoading: false, data: undefined };
  window.localStorage.clear();
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

// Regression coverage: this button used to say "Start my free check"
// forever, even for a returning patient who had already used up both their
// 3 free checks and any paid credit — SignInStep.tsx now remembers the
// signed-in phone specifically so this page can recognize that case.
describe("Home page free-check button copy", () => {
  it('says "Start my free check" for a first-time visitor with no remembered phone', () => {
    mockRole = null;
    mockSubscription = { isLoading: false, data: undefined };

    render(<Home />);

    expect(screen.getByText("Start my free check")).toBeInTheDocument();
  });

  it('switches to "Start My Check" for a returning patient who has exhausted both free and paid checks', () => {
    mockRole = null;
    mockSubscription = { isLoading: false, data: undefined };
    window.localStorage.setItem("mediguard-last-check-phone", "+233244123456");
    mockQuota = { isLoading: false, data: { freeRemaining: 0, paidAvailable: 0, phoneVerified: true } };

    render(<Home />);

    expect(screen.getByText("Start My Check")).toBeInTheDocument();
    expect(screen.queryByText("Start my free check")).not.toBeInTheDocument();
  });

  it("keeps the default copy for a returning patient who still has free checks remaining", () => {
    mockRole = null;
    mockSubscription = { isLoading: false, data: undefined };
    window.localStorage.setItem("mediguard-last-check-phone", "+233244123456");
    mockQuota = { isLoading: false, data: { freeRemaining: 1, paidAvailable: 0, phoneVerified: true } };

    render(<Home />);

    expect(screen.getByText("Start my free check")).toBeInTheDocument();
  });

  it("keeps the default copy for a returning patient who has paid credit available", () => {
    mockRole = null;
    mockSubscription = { isLoading: false, data: undefined };
    window.localStorage.setItem("mediguard-last-check-phone", "+233244123456");
    mockQuota = { isLoading: false, data: { freeRemaining: 0, paidAvailable: 2, phoneVerified: true } };

    render(<Home />);

    expect(screen.getByText("Start my free check")).toBeInTheDocument();
  });
});
