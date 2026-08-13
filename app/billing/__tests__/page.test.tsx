import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const showToastMock = vi.fn();
const initiatePaymentMock = vi.fn();

const subscriptionState = {
  isLoading: false,
  data: { isActive: false, periodEnd: null } as { isActive: boolean; periodEnd: string | null } | undefined,
};
const paymentStatusByReference = new Map<string, { status: "pending" | "success" | "failed" }>();
let paymentTimedOut = false;
let pendingPaymentLookup: { isSuccess: boolean; data: string | null } = { isSuccess: true, data: null };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/store/toast-store", () => ({
  useToastStore: (selector: (s: { show: typeof showToastMock }) => unknown) => selector({ show: showToastMock }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ role: "prescriber", hasHydrated: true }),
}));

vi.mock("@/lib/query/hooks/useSubscriptionStatus", () => ({
  useSubscriptionStatus: () => subscriptionState,
  useInitiateSubscriptionPayment: () => ({ mutate: initiatePaymentMock, isPending: false }),
  useSubscriptionPaymentStatus: (reference: string | null) => ({
    data: reference ? paymentStatusByReference.get(reference) : undefined,
  }),
  useFindPendingSubscriptionPayment: () => pendingPaymentLookup,
}));

vi.mock("@/lib/hooks/usePaymentTimeout", () => ({
  usePaymentTimeout: () => paymentTimedOut,
}));

const { default: BillingPage } = await import("../page");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  paymentStatusByReference.clear();
  subscriptionState.data = { isActive: false, periodEnd: null };
  subscriptionState.isLoading = false;
  paymentTimedOut = false;
  pendingPaymentLookup = { isSuccess: true, data: null };
});

function payNow() {
  fireEvent.change(screen.getByPlaceholderText(/0244 123 456/), { target: { value: "0244123456" } });
  fireEvent.click(screen.getByRole("button", { name: /pay ghs/i }));
}

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

// Regression coverage for removing the separate `paying` state (react-hooks/
// set-state-in-effect) — "is a payment in flight" is now fully derived from
// paymentReference + the payment's own settled status, with no manual reset
// step. These lock in that the derived version behaves identically to the
// original state-tracked one.
describe("BillingPage — payment state is derived, not manually reset", () => {
  it("shows the payment form when there is no subscription and no payment in flight", () => {
    render(<BillingPage />);
    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });

  it("shows the pending 'approve on your phone' state right after a successful initiate, with a working Cancel", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_pending", { status: "pending" });
      onSuccess({ reference: "ref_pending", displayMessage: "Check your phone." });
    });

    render(<BillingPage />);
    payNow();

    expect(screen.getByText(/approve the payment request/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });

  it("shows 'Payment failed' immediately once status is 'failed', and Try again returns to a fresh form", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_declined", { status: "failed" });
      onSuccess({ reference: "ref_declined", displayMessage: "Check your phone." });
    });

    render(<BillingPage />);
    payNow();

    expect(screen.getByText(/payment failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/approve the payment request/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });

  it("switches the pending button to 'Try again' once the timeout hook reports timed out", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_slow", { status: "pending" });
      onSuccess({ reference: "ref_slow", displayMessage: "Check your phone." });
    });
    paymentTimedOut = true;

    render(<BillingPage />);
    payNow();

    expect(screen.getByText(/didn.t get the prompt/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows the active-subscription state and fires the success toast exactly once when isActive flips true after paying", async () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_ok", { status: "pending" });
      onSuccess({ reference: "ref_ok", displayMessage: "Check your phone." });
    });

    const { rerender } = render(<BillingPage />);
    payNow();
    expect(screen.getByText(/approve the payment request/i)).toBeInTheDocument();
    // payNow() itself fires a "Payment requested" toast — a real, separate
    // event from activation. Reset the mock here so the assertions below
    // isolate the activation toast specifically.
    showToastMock.mockClear();

    subscriptionState.data = { isActive: true, periodEnd: "2027-01-01T00:00:00Z" };
    paymentStatusByReference.set("ref_ok", { status: "success" });
    rerender(<BillingPage />);

    await waitFor(() => expect(screen.getByText(/active until/i)).toBeInTheDocument());
    expect(showToastMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Subscription active" }));

    // A later, unrelated re-render with the same settled state must not re-fire the toast.
    rerender(<BillingPage />);
    expect(showToastMock).toHaveBeenCalledTimes(1);
  });

  it("never shows the success toast for an already-active subscription with no payment attempted this session", () => {
    subscriptionState.data = { isActive: true, periodEnd: "2027-01-01T00:00:00Z" };
    render(<BillingPage />);
    expect(screen.getByText(/active until/i)).toBeInTheDocument();
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

// Regression coverage: a payment initiated in an earlier page load (then the
// tab refreshed or was reopened before it resolved) used to be untraceable —
// paymentReference lived only in that one mount's component state, so a
// refresh silently dropped back to the plain "Pay" form even with a real
// charge potentially still in flight. This is exactly what "paid but the
// portal never opened" looks like from the billing page's own point of view.
describe("BillingPage — resuming a payment already in flight from a previous page load", () => {
  it("resumes polling a pending payment found on mount instead of showing the plain form", () => {
    pendingPaymentLookup = { isSuccess: true, data: "ref_from_before" };
    paymentStatusByReference.set("ref_from_before", { status: "pending" });

    render(<BillingPage />);

    expect(screen.getByText(/approve the payment request/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay ghs/i })).not.toBeInTheDocument();
  });

  it("shows the plain form when the lookup finds nothing pending", () => {
    pendingPaymentLookup = { isSuccess: true, data: null };
    render(<BillingPage />);
    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });
});
