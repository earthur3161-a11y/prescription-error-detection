import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const quotaState = {
  data: undefined as { freeRemaining: number; paidAvailable: number; phoneVerified: boolean } | undefined,
  isFetching: false,
  isError: false,
  refetch: vi.fn(),
};
const paymentStatusByReference = new Map<string, { status: "pending" | "success" | "failed" }>();
const initiatePaymentMock = vi.fn();
const submitOtpMock = vi.fn();
let submitOtpPending = false;
// Defaults to "checked, nothing pending" — the common case for a fresh
// payment attempt. Tests exercising the resume-after-reload path override this.
let pendingPaymentLookup: { isSuccess: boolean; data: { reference: string; awaitingOtp: boolean } | null | undefined } = {
  isSuccess: true,
  data: null,
};

vi.mock("@/lib/store/toast-store", () => ({
  useToastStore: (selector: (s: { show: (t: unknown) => void }) => unknown) => selector({ show: vi.fn() }),
}));

vi.mock("@/lib/query/hooks/useCheckQuota", () => ({
  useCheckQuota: () => quotaState,
  useInitiatePayment: () => ({ mutate: initiatePaymentMock, isPending: false }),
  useSubmitCheckOtp: () => ({ mutate: submitOtpMock, isPending: submitOtpPending }),
  usePaymentStatus: (reference: string | null) => ({
    data: reference ? paymentStatusByReference.get(reference) : undefined,
  }),
  useFindPendingCheckPayment: () => pendingPaymentLookup,
}));

const { UnlockCheckStep } = await import("../UnlockCheckStep");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  paymentStatusByReference.clear();
  quotaState.data = undefined;
  quotaState.isError = false;
  submitOtpPending = false;
  pendingPaymentLookup = { isSuccess: true, data: null };
});

// Phone identity is verified upstream by SignInStep before this component is
// ever reached — it only takes an already-confirmed phone, never asks for
// one itself.
describe("UnlockCheckStep — takes an already-verified phone directly", () => {
  it("shows a loading state while quota is still resolving, no phone form", () => {
    quotaState.data = undefined;
    quotaState.isFetching = true;

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    expect(screen.queryByLabelText(/phone number/i)).not.toBeInTheDocument();
    expect(screen.getByText(/checking your account/i)).toBeInTheDocument();
    quotaState.isFetching = false;
  });

  it("shows remaining free checks and a 'See my result' button once quota resolves with credit", () => {
    quotaState.data = { freeRemaining: 2, paidAvailable: 0, phoneVerified: true };

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    expect(screen.getByText(/2 free checks remaining/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see my result/i })).toBeInTheDocument();
  });

  it("calls onUnlocked with the given phone when 'See my result' is clicked", () => {
    quotaState.data = { freeRemaining: 1, paidAvailable: 0, phoneVerified: true };
    const onUnlocked = vi.fn();

    render(<UnlockCheckStep onUnlocked={onUnlocked} unlocking={false} phone="0244123456" />);
    fireEvent.click(screen.getByRole("button", { name: /see my result/i }));

    expect(onUnlocked).toHaveBeenCalledWith("0244123456");
  });

  it("shows the pay screen when there's no free or paid credit", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });
});

describe("UnlockCheckStep — payment failure surfaces immediately, not just via the pending timeout", () => {
  it("shows a 'Payment failed' state with a working retry as soon as status is 'failed' — no stuck spinner", async () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_fast_decline", { status: "failed" });
      onSuccess({ reference: "ref_fast_decline", displayMessage: "Check your phone to approve." });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
    fireEvent.click(screen.getByRole("button", { name: /pay ghs/i }));

    // Must appear immediately — this must NOT depend on PAYMENT_TIMEOUT_MS
    // (2 minutes), which only ever arms while status stays "pending".
    await waitFor(() => expect(screen.getByText(/payment failed/i)).toBeInTheDocument());
    expect(screen.queryByText(/check your phone/i)).not.toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);

    // Retry must actually work — back to a real, re-payable state, not a dead end.
    await waitFor(() => expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument());
  });

  it("still shows the pending spinner (not the failed state) while status is genuinely pending", async () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_pending", { status: "pending" });
      onSuccess({ reference: "ref_pending", displayMessage: "Check your phone to approve." });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
    fireEvent.click(screen.getByRole("button", { name: /pay ghs/i }));

    await waitFor(() => expect(screen.getByText(/check your phone/i)).toBeInTheDocument());
    expect(screen.queryByText(/payment failed/i)).not.toBeInTheDocument();
  });
});

// Regression coverage: quota.isFetching stays false and quota.data stays
// undefined forever after a genuine RPC failure exhausts its retry — without
// a dedicated isError branch, the loading guard's `!quota.data` check never
// resolves and this screen gets stuck on the spinner indefinitely.
describe("UnlockCheckStep — quota lookup failure doesn't strand the patient on a spinner", () => {
  it("shows an error state with a working retry instead of an infinite spinner", () => {
    quotaState.data = undefined;
    quotaState.isFetching = false;
    quotaState.isError = true;

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    expect(screen.queryByText(/checking your account/i)).not.toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);
    expect(quotaState.refetch).toHaveBeenCalled();
  });
});

// Regression coverage: this is the actual production incident — a live
// self-check payment crashed with React error #185 (max update depth) on
// every successful payment. Root cause: onUnlocked is a prop, and its real
// owner (app/check/new/page.tsx) recreates that callback on every render,
// including the very re-render calling it triggers (createCheck.isPending
// flips the instant .mutate() runs, and that's also passed down as
// `unlocking`). Without a guard, the effect below re-fires every time that
// unstable reference changes, and since the success condition never stops
// being true, it kept calling onUnlocked again — a tight, self-sustaining
// loop. This must hold regardless of what the parent does, so the test
// drives it by re-rendering with a brand-new callback each time, exactly
// like the real unmemoized parent does.
describe("UnlockCheckStep — onUnlocked fires exactly once per successful payment", () => {
  it("never calls onUnlocked again after success, even if the parent passes a new callback reference on every re-render", async () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    pendingPaymentLookup = { isSuccess: true, data: { reference: "ref_success", awaitingOtp: false } };
    paymentStatusByReference.set("ref_success", { status: "success" });

    const onUnlocked1 = vi.fn();
    const { rerender } = render(<UnlockCheckStep onUnlocked={onUnlocked1} unlocking={false} phone="0244123456" />);

    await waitFor(() => expect(onUnlocked1).toHaveBeenCalledTimes(1));

    // Simulate the parent re-rendering with a brand-new callback reference —
    // exactly what the real, unmemoized handleUnlocked does on every render
    // triggered by createCheck.isPending changing.
    const onUnlocked2 = vi.fn();
    rerender(<UnlockCheckStep onUnlocked={onUnlocked2} unlocking={true} phone="0244123456" />);
    const onUnlocked3 = vi.fn();
    rerender(<UnlockCheckStep onUnlocked={onUnlocked3} unlocking={false} phone="0244123456" />);

    expect(onUnlocked1).toHaveBeenCalledTimes(1);
    expect(onUnlocked2).not.toHaveBeenCalled();
    expect(onUnlocked3).not.toHaveBeenCalled();
  });
});

// Regression coverage: this component's own step/paymentReference state
// doesn't survive a reload (the wizard resets to "signin" either way), so
// without this, a patient who reloads mid-payment sees the payment form
// again for something they may have already paid for.
describe("UnlockCheckStep — resumes a payment already in flight from a previous page load", () => {
  it("jumps straight to the pending-payment screen when one is found for this phone", async () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    pendingPaymentLookup = { isSuccess: true, data: { reference: "ref_resumed", awaitingOtp: false } };
    paymentStatusByReference.set("ref_resumed", { status: "pending" });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    await waitFor(() => expect(screen.getByText(/check your phone/i)).toBeInTheDocument());
    expect(initiatePaymentMock).not.toHaveBeenCalled();
  });

  // Regression coverage: the resume path used to only restore the
  // reference, never awaitingOtp — a payment resumed from a reload while
  // genuinely mid-OTP fell into the plain polling spinner with no way to
  // enter the code the patient already received.
  it("resumes straight into the OTP step when the pending payment was awaiting a code", async () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    pendingPaymentLookup = { isSuccess: true, data: { reference: "ref_otp_resumed", awaitingOtp: true } };
    paymentStatusByReference.set("ref_otp_resumed", { status: "pending" });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    await waitFor(() => expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument());
    expect(screen.queryByText(/check your phone/i)).not.toBeInTheDocument();
  });

  it("shows the normal pay form when the lookup finds nothing pending", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    pendingPaymentLookup = { isSuccess: true, data: null };

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });
});

// Regression coverage for the missing OTP relay step: Paystack's Mobile
// Money "send_otp" flow (lib/payments/paystackCharge.ts) doesn't complete
// until the code the patient received is submitted back via
// useSubmitCheckOtp. Before this, initiate's awaitingOtp flag was never
// read at all, so the patient had no way to enter that code.
describe("UnlockCheckStep — OTP relay for Paystack's send_otp Mobile Money flow", () => {
  function payNow() {
    fireEvent.click(screen.getByRole("button", { name: /pay ghs/i }));
  }

  it("shows an OTP input instead of the spinner when initiate reports awaitingOtp", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
    payNow();

    expect(screen.getByText(/enter the code sent to your phone/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
  });

  // Regression coverage: a real incident showed the OTP box disappearing
  // within seconds — usePaymentStatus was polling /verify immediately once
  // a reference existed, with no gate on awaitingOtp, and Paystack's
  // /transaction/verify returned a status read as "failed" for a charge
  // that was still legitimately waiting on the code relay. Since the
  // failed check runs before the OTP branch, that yanked the code box away
  // before the patient had any chance to use it. The hook must not even be
  // queried with the real reference while awaitingOtp is true — simulated
  // here by seeding a "failed" status for that reference and confirming
  // it's never surfaced while the OTP box is up.
  it("never shows Payment failed while awaitingOtp is true, even if the (unqueried) status would read failed", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    paymentStatusByReference.set("ref_otp", { status: "failed" });
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
    payNow();

    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
    expect(screen.queryByText(/payment failed/i)).not.toBeInTheDocument();
  });

  it("submits the entered code and falls through to the polling spinner on success", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });
    submitOtpMock.mockImplementation((_params, { onSuccess }) => {
      onSuccess({ ok: true, message: "Code accepted." });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
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
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });
    submitOtpMock.mockImplementation((_params, { onSuccess }) => {
      onSuccess({ ok: false, message: "That code wasn't accepted. Please try again." });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
    payNow();
    fireEvent.change(screen.getByPlaceholderText(/enter code/i), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /submit code/i }));

    expect(screen.getByText(/that code wasn.t accepted/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter code/i)).toBeInTheDocument();
  });

  // Regression coverage: unlike the sibling billing/page.test.tsx, this
  // file never actually clicked the Cancel button next to Submit code — the
  // only escape hatch from a stuck/wrong-code entry in the patient-facing
  // flow was completely unverified.
  it("Cancel from the OTP step returns to the plain pay form", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
    payNow();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });

  // Regression coverage: useSubmitCheckOtp was mocked as a hardcoded
  // { isPending: false } literal everywhere else in this file, so no test
  // could ever exercise the Submit code button's disabled/spinner state —
  // a regression dropping `submitOtp.isPending ||` from the disabled
  // condition would still pass every test. submitOtpPending is mutable
  // specifically so this test can flip it.
  it("disables Submit code and shows a spinner while the OTP submission is in flight", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_otp", { status: "pending" });
      onSuccess({ reference: "ref_otp", displayMessage: "Enter the code sent to your phone.", awaitingOtp: true });
    });
    submitOtpPending = true;

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);
    payNow();
    fireEvent.change(screen.getByPlaceholderText(/enter code/i), { target: { value: "123456" } });

    // Can't query by name "Submit code" here — the pending state swaps that
    // text for a spinner icon, which is the whole thing being verified.
    // Identify it by being the disabled button (Cancel never disables).
    const submitButton = screen.getAllByRole("button").find((b) => b.hasAttribute("disabled"));
    expect(submitButton).toBeDisabled();
    expect(submitButton?.querySelector("svg")).toBeInTheDocument();
  });
});
