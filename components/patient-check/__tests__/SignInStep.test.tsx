import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { installMemoryLocalStorage } from "@/vitest-stubs/memoryLocalStorage";

const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
let sendOtpData: { demoMode?: boolean } | undefined;

beforeAll(() => {
  installMemoryLocalStorage();
});

vi.mock("@/lib/store/toast-store", () => ({
  useToastStore: (selector: (s: { show: (t: unknown) => void }) => unknown) => selector({ show: vi.fn() }),
}));

vi.mock("@/lib/query/hooks/usePhoneVerification", () => ({
  useSendOtp: () => ({ mutate: sendOtpMock, isPending: false, data: sendOtpData }),
  useVerifyOtp: () => ({ mutate: verifyOtpMock, isPending: false }),
}));

const { SignInStep } = await import("../SignInStep");

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  sendOtpData = undefined;
  window.localStorage.clear();
});

// Regression coverage for the mandatory sign-in gate added ahead of Patient
// Self-Check: every patient must verify their phone before reaching the
// drug-picker step, and the messaging must actually say what they get for it.
describe("SignInStep", () => {
  it("advertises 3 free checks and asks for a phone number up front", () => {
    render(<SignInStep onSignedIn={vi.fn()} />);

    expect(screen.getByText(/3 free prescription checks/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it("sends an OTP and moves to the code-entry screen on a valid phone", () => {
    render(<SignInStep onSignedIn={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(sendOtpMock).toHaveBeenCalledWith("+233244123456", expect.anything());
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  // Regression coverage: this used to send whatever the patient literally
  // typed (commonly 0XXXXXXXXX) straight through to both the SMS API and
  // every phone-keyed DB lookup — Africa's Talking's API requires E.164 for
  // real delivery, so a locally-formatted number could fail to actually
  // reach a real patient's phone even though the API call itself "succeeded".
  it("normalizes a locally-formatted phone number to E.164 before it ever leaves this component", () => {
    render(<SignInStep onSignedIn={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "055 724 1928" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(sendOtpMock).toHaveBeenCalledWith("+233557241928", expect.anything());
  });

  // Regression coverage: this message used to be driven by
  // NEXT_PUBLIC_ENABLE_DEV_ACCOUNTS alone, which is also true on the real
  // production deployment (it separately gates the seeded professional demo
  // logins there) — so real patients on production saw "enter any digits"
  // even though the server-side OTP bypass never activates there. The
  // message must instead reflect what the send response actually reported.
  it("tells the patient a real code was sent when the server did not report demo mode", () => {
    sendOtpData = {};
    render(<SignInStep onSignedIn={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Sent to +233244123456.")).toBeInTheDocument();
    expect(screen.queryByText(/simulated in this demo/i)).not.toBeInTheDocument();
  });

  it("tells the patient the code is simulated only when the server actually reports demo mode", () => {
    sendOtpData = { demoMode: true };
    render(<SignInStep onSignedIn={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText(/simulated in this demo/i)).toBeInTheDocument();
  });

  it("skips straight to signed-in when the phone is already verified (alreadyVerified)", () => {
    sendOtpMock.mockImplementation((_phone, { onSuccess }) => onSuccess({ alreadyVerified: true }));
    const onSignedIn = vi.fn();

    render(<SignInStep onSignedIn={onSignedIn} />);
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(onSignedIn).toHaveBeenCalledWith("+233244123456");
  });

  // Regression coverage: app/page.tsx reads this back to greet a returning,
  // quota-exhausted patient with "Start My Check" instead of the first-time
  // "Start my free check" — it has no other way to know a patient has been
  // here before.
  it("remembers the phone in localStorage once signed in (alreadyVerified), so the homepage can recognize a returning patient later", () => {
    sendOtpMock.mockImplementation((_phone, { onSuccess }) => onSuccess({ alreadyVerified: true }));

    render(<SignInStep onSignedIn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(window.localStorage.getItem("mediguard-last-check-phone")).toBe("+233244123456");
  });

  it("calls onSignedIn with the confirmed phone once the OTP verifies", async () => {
    verifyOtpMock.mockImplementation((_params, { onSuccess }) => onSuccess({ verified: true }));
    const onSignedIn = vi.fn();

    render(<SignInStep onSignedIn={onSignedIn} />);
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("+233244123456"));
  });

  it("remembers the phone in localStorage once the OTP verifies", async () => {
    verifyOtpMock.mockImplementation((_params, { onSuccess }) => onSuccess({ verified: true }));

    render(<SignInStep onSignedIn={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(window.localStorage.getItem("mediguard-last-check-phone")).toBe("+233244123456"));
  });

  it("does not call onSignedIn when the code is wrong", () => {
    verifyOtpMock.mockImplementation((_params, { onSuccess }) => onSuccess({ verified: false }));
    const onSignedIn = vi.fn();

    render(<SignInStep onSignedIn={onSignedIn} />);
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: "0244123456" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
