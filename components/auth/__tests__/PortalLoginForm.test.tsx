import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Stethoscope } from "lucide-react";

const replaceMock = vi.fn();
const loginMock = vi.fn();
const authenticateMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({ login: loginMock, role: null, hasHydrated: true }),
}));

vi.mock("@/lib/data/repositories/accountRepository", () => ({
  authenticate: authenticateMock,
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { auth: { resetPasswordForEmail: resetPasswordForEmailMock } },
}));

const { PortalLoginForm } = await import("../PortalLoginForm");

const config = {
  role: "prescriber" as const,
  signupHref: "/physician/signup",
  portalName: "Physician Portal",
  tagline: "Test tagline",
  icon: Stethoscope,
  accentClass: "",
  iconClass: "",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Regression test: this form used to require a 6-digit "Authenticator code"
// that was never actually checked — validated for format only, then silently
// discarded (never even passed to authenticate()). Removed rather than wired
// up to real MFA (a separate, deliberate follow-up), since shipping a fake
// security control is worse than shipping none. This test would fail loudly
// if the field, or anything shaped like it, came back without also being
// real.
describe("PortalLoginForm", () => {
  it("has no authenticator/MFA field of any kind", () => {
    render(<PortalLoginForm config={config} />);

    expect(screen.queryByLabelText(/authenticator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/multi-factor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/6-digit/i)).not.toBeInTheDocument();
  });

  it("signs in with only email and password", async () => {
    authenticateMock.mockResolvedValue({
      id: "u1",
      email: "doc@example.com",
      role: "prescriber",
      name: "Dr. Test",
      title: "Physician",
      institutionId: null,
    });

    render(<PortalLoginForm config={config} />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "doc@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(authenticateMock).toHaveBeenCalledWith("doc@example.com", "correct-password", "prescriber"));
    expect(loginMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("shows a generic error when authenticate() returns null, without ever mentioning MFA", async () => {
    authenticateMock.mockResolvedValue(null);

    render(<PortalLoginForm config={config} />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "doc@example.com" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid login/i));
  });
});

describe("PortalLoginForm — forgot password", () => {
  it("switches to a reset-request form, sends the reset email, and can return to sign in", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    render(<PortalLoginForm config={config} />);

    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "doc@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));

    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    const resetEmailInput = screen.getByLabelText(/work email/i) as HTMLInputElement;
    expect(resetEmailInput.value).toBe("doc@example.com");

    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(resetPasswordForEmailMock).toHaveBeenCalledWith(
        "doc@example.com",
        expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password") })
      )
    );
    await waitFor(() => expect(screen.getByText(/reset link is on its way/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /back to sign in/i }));
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("never reveals whether the account exists, even when resetPasswordForEmail errors", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: { message: "network down" } });

    render(<PortalLoginForm config={config} />);

    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: "doc@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText(/account exists|no account|not found/i)).not.toBeInTheDocument();
  });
});
