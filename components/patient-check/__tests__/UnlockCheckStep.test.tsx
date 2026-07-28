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

vi.mock("@/lib/store/toast-store", () => ({
  useToastStore: (selector: (s: { show: (t: unknown) => void }) => unknown) => selector({ show: vi.fn() }),
}));

vi.mock("@/lib/query/hooks/usePhoneVerification", () => ({
  useSendOtp: () => ({ mutate: vi.fn(), isPending: false }),
  useVerifyOtp: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/query/hooks/useCheckQuota", () => ({
  // Mirrors the real hook's `enabled: !!phone` — data must stay undefined
  // until a phone is actually confirmed, or the component's own effect
  // (which advances subStep the moment quota.data is truthy) skips the
  // phone-entry step before the test ever gets to interact with it.
  useCheckQuota: (phone: string | null) => (phone ? quotaState : { ...quotaState, data: undefined }),
  useInitiatePayment: () => ({ mutate: initiatePaymentMock, isPending: false }),
  usePaymentStatus: (reference: string | null) => ({
    data: reference ? paymentStatusByReference.get(reference) : undefined,
  }),
}));

const { UnlockCheckStep } = await import("../UnlockCheckStep");

describe("UnlockCheckStep — payment failure surfaces immediately, not just via the pending timeout", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    paymentStatusByReference.clear();
    quotaState.data = undefined;
  });

  it("shows a 'Payment failed' state with a working retry as soon as status is 'failed' — no stuck spinner", async () => {
    // A verified phone with no free/paid credit — the "pay" screen.
    quotaState.data = { freeRemaining: 0, paidAvailable: 0, phoneVerified: true };
    initiatePaymentMock.mockImplementation((_params, { onSuccess }) => {
      paymentStatusByReference.set("ref_fast_decline", { status: "failed" });
      onSuccess({ reference: "ref_fast_decline", displayMessage: "Check your phone to approve." });
    });

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} initialPhone={null} />);

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument());
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

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} initialPhone={null} />);
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /pay ghs/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /pay ghs/i }));

    await waitFor(() => expect(screen.getByText(/check your phone/i)).toBeInTheDocument());
    expect(screen.queryByText(/payment failed/i)).not.toBeInTheDocument();
  });
});

describe("UnlockCheckStep — initialPhone (the 'already paid?' resume path)", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    paymentStatusByReference.clear();
    quotaState.data = undefined;
  });

  it("skips the phone-entry form entirely and goes straight to the credit screen when a verified, paid phone is passed in", async () => {
    quotaState.data = { freeRemaining: 0, paidAvailable: 1, phoneVerified: true };

    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} initialPhone="0244123456" />);

    expect(screen.queryByLabelText(/^phone number$/i)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/paid check ready to use/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /see my result/i })).toBeInTheDocument();
  });

  it("still asks for a phone the normal way when initialPhone is null", () => {
    render(<UnlockCheckStep onUnlocked={vi.fn()} unlocking={false} initialPhone={null} />);
    expect(screen.getByLabelText(/^phone number$/i)).toBeInTheDocument();
  });
});
