import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Topbar } from "../Topbar";

const replaceMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Ama Owusu", title: "MD" },
    role: "prescriber",
    logout: logoutMock,
  }),
}));

vi.mock("@/lib/hooks/useIsOffline", () => ({
  useIsOffline: () => false,
}));

vi.mock("@/lib/query/hooks/useOutbox", () => ({
  usePendingOutbox: () => ({ data: [] }),
}));

afterEach(() => {
  cleanup();
  replaceMock.mockClear();
  logoutMock.mockClear();
});

// Regression test: the hamburger and sign-out buttons used to be well under
// the ~44px touch-target guideline (p-2/size-9), on the one shell rendered
// on every page for every professional role.
describe("Topbar touch targets", () => {
  it("gives the mobile menu button a real ~44px hit box", () => {
    render(<Topbar onMenuClick={vi.fn()} />);
    const menuButton = screen.getByRole("button", { name: /open navigation menu/i });
    expect(menuButton.className).toMatch(/size-11/);
  });

  it("gives the sign-out button a real ~44px hit box", () => {
    render(<Topbar onMenuClick={vi.fn()} />);
    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    expect(signOutButton.className).toMatch(/size-11/);
  });

  it("shows the user's name on mobile instead of hiding it entirely", () => {
    render(<Topbar onMenuClick={vi.fn()} />);
    const name = screen.getByText("Ama Owusu");
    expect(name.className).not.toMatch(/\bhidden\b/);
  });
});

// Regression coverage for the systemwide auth audit: confirms the sign-out
// control actually signs out (not just that it exists/is sized correctly).
describe("Topbar sign-out behavior", () => {
  it("calls logout() and navigates to /login when clicked", () => {
    render(<Topbar onMenuClick={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  it("opens the mobile nav when the hamburger is clicked", () => {
    const onMenuClick = vi.fn();
    render(<Topbar onMenuClick={onMenuClick} />);

    fireEvent.click(screen.getByRole("button", { name: /open navigation menu/i }));

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });
});
