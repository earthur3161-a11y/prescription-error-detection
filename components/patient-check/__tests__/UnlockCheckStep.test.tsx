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
// Defaults to "checked, nothing pending" — the common case for a fresh
// payment attempt. Tests exercising the resume-after-reload path override this.
let pendingPaymentLookup: { isSuccess: boolean; data: string | null | undefined } = {
  isSuccess: true,
  data: null,
};

vi.mock("@/lib/store/toast-store", () => ({
  useToastStore: (selector: (s: { show: (t: unknown) => void }) => unknown) => selector({ show: vi.fn() }),
}));

vi.mock("@/lib/query/hooks/useCheckQuota", () => ({
  useCheckQuota: () => quotaState,
  useInitiatePayment: () => ({ mutate: initiatePaymentMock, isPending: false }),
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

// Regression coverage: this component's own step/paymentReference state
// doesn't survive a reload (the wizard resets to "signin" either way), so
// without this, a patient who reloads mid-payment sees the payment form
// again for something they may have already paid for.
describe("UnlockCheckStep — resumes a payment already in flight from a previous page load", () => {
  it("jumps straight to the pending-payment screen when one is found for this phone", async () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    pendingPaymentLookup = { isSuccess: true, data: "ref_resumed" };
    paymentStatusByReference.set("ref_resumed", { status: "pending" });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    await waitFor(() => expect(screen.getByText(/check your phone/i)).toBeInTheDocument());
    expect(initiatePaymentMock).not.toHaveBeenCalled();
  });

  it("shows the normal pay form when the lookup finds nothing pending", () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    pendingPaymentLookup = { isSuccess: true, data: null };

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} phone="0244123456" />);

    expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument();
  });
});
