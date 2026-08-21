import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const showToastMock = vi.fn();
const initiatePaymentMock = vi.fn();
const submitOtpMock = vi.fn();

const subscriptionState = {
  isLoading: false,
  data: { isActive: false, periodEnd: null } as { isActive: boolean; periodEnd: string | null } | undefined,
};
const paymentStatusByReference = new Map<string, { status: "pending" | "success" | "failed" }>();
let paymentTimedOut = false;
let submitOtpPending = false;
let pendingPaymentLookup: { isSuccess: boolean; data: { reference: string; awaitingOtp: boolean } | null } = {
  isSuccess: true,
  data: null,
};

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
  useSubmitSubscriptionOtp: () => ({ mutate: submitOtpMock, isPending: submitOtpPending }),
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
  submitOtpPending = false;
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
// (Rendered as the MediGuard logo/wordmark, not literal "return home" text,
// since the design pass — the accessible name comes from that visible text.)
describe("Billing page home link", () => {
  it("links to / (app/page.tsx is responsible for not looping this back)", () => {
    render(<BillingPage />);

    const homeLink = screen.getByRole("link", { name: /mediguard/i });
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

    expect(screen.getByText(/check your phone/i)).toBeInTheDocument();
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
    expect(screen.getByText(/check your phone/i)).toBeInTheDocument();
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

// Regression coverage for the missing OTP relay step: Paystack's Mobile
// Money "send_otp" flow (lib/payments/paystackCharge.ts) doesn't complete
// until the code the customer received is submitted back via
// useSubmitSubscriptionOtp. Before this, initiate's awaitingOtp flag was
// never read at all, so the customer had no way to enter that code.
describe("BillingPage — OTP relay for Paystack's send_otp Mobile Money flow", () => {
  it("shows an OTP input instead of the spinner when initiate reports awaitingOtp", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });

    render(<BillingPage />);
    payNow();

    expect(screen.getByText(/enter the code sent to your phone/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
    expect(screen.queryByText(/check your phone/i)).not.toBeInTheDocument();
  });

  // Regression coverage: a real incident showed the OTP box disappearing
  // within seconds — useSubscriptionPaymentStatus was polling /verify
  // immediately once a reference existed, with no gate on awaitingOtp, and
  // Paystack's /transaction/verify returned a status read as "failed" for a
  // charge that was still legitimately waiting on the code relay. Since
  // paymentFailed is checked before the OTP branch, that yanked the code
  // box away before the customer had any chance to use it. The hook must
  // not even be queried with the real reference while awaitingOtp is true —
  // simulated here by seeding a "failed" status for that reference and
  // confirming it's never surfaced while the OTP box is up.
  it("never shows Payment failed while awaitingOtp is true, even if the (unqueried) status would read failed", () => {
    paymentStatusByReference.set("ref_otp", { status: "failed" });
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });

    render(<BillingPage />);
    payNow();

    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
    expect(screen.queryByText(/payment failed/i)).not.toBeInTheDocument();
  });

  it("submits the entered code and falls through to the polling spinner on success", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });
    submitOtpMock.mockImplementation((_params, { onSuccess }) => {
      onSuccess({ ok: true, message: "Code accepted." });
    });

    render(<BillingPage />);
    payNow();
    fireEvent.change(screen.getByPlaceholderText(/enter code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /submit code/i }));

    expect(submitOtpMock).toHaveBeenCalledWith(
      { reference: "ref_otp", otp: "123456" },
      expect.anything()
    );
    expect(screen.queryByPlaceholderText(/enter code/i)).not.toBeInTheDocument();
    expect(screen.getByText(/check your phone/i)).toBeInTheDocument();
  });

  it("shows the error message and keeps the OTP form open when the code is rejected", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });
    submitOtpMock.mockImplementation((_params, { onSuccess }) => {
      onSuccess({ ok: false, message: "That code wasn't accepted. Please try again." });
    });

    render(<BillingPage />);
    payNow();
    fireEvent.change(screen.getByPlaceholderText(/enter code/i), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /submit code/i }));

    expect(screen.getByText(/that code wasn.t accepted/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
  });

  it("Cancel from the OTP step returns to the plain pay form", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });

    render(<BillingPage />);
    payNow();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
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
    pendingPaymentLookup = { isSuccess: true, data: { reference: "ref_from_before", awaitingOtp: false } };
    paymentStatusByReference.set("ref_from_before", { status: "pending" });

    render(<BillingPage />);

    expect(screen.getByText(/check your phone/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay ghs/i })).not.toBeInTheDocument();
  });

  it("shows the plain form when the lookup finds nothing pending", () => {
    pendingPaymentLookup = { isSuccess: true, data: null };
    render(<BillingPage />);
    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });

  // Regression coverage: the resume path used to only restore the
  // reference, never awaitingOtp — a payment resumed from a reload while
  // genuinely mid-OTP fell into the plain polling spinner with no way to
  // enter the code the customer already received.
  it("resumes straight into the OTP step when the pending payment was awaiting a code", () => {
    pendingPaymentLookup = { isSuccess: true, data: { reference: "ref_otp_resumed", awaitingOtp: true } };
    paymentStatusByReference.set("ref_otp_resumed", { status: "pending" });

    render(<BillingPage />);

    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
    expect(screen.queryByText(/check your phone/i)).not.toBeInTheDocument();
  });
});

// Regression coverage: an adversarial review found useSubmitSubscriptionOtp
// mocked as a hardcoded { isPending: false } literal everywhere else in this
// file — meaning no test could ever exercise the Submit code button's
// disabled/spinner state, so a regression dropping `submitOtp.isPending ||`
// from the disabled condition would still pass every test. submitOtpPending
// is mutable (mirrors subscriptionState/paymentTimedOut's existing pattern)
// specifically so this suite can flip it.
describe("BillingPage — Submit code button reflects submission state", () => {
  it("disables Submit code and shows a spinner while the OTP submission is in flight", () => {
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp_pending", { status: "pending" });
      onSuccess({ reference: "ref_otp_pending", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });
    submitOtpPending = true;

    render(<BillingPage />);
    payNow();
    fireEvent.change(screen.getByPlaceholderText(/enter code/i), { target: { value: "123456" } });

    // Can't query by name "Submit code" here — the pending state swaps that
    // text for a spinner icon, which is the whole thing being verified. The
    // page also renders an unrelated always-present "Not you? Sign out"
    // button, so identify the submit button by being the disabled one.
    const submitButton = screen.getAllByRole("button").find((b) => b.hasAttribute("disabled"));
    expect(submitButton).toBeDisabled();
    expect(submitButton?.querySelector("svg")).toBeInTheDocument();
  });
});
