import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Topbar } from "../Topbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/auth/useAuth", () => ({
  useAuth: () => ({
    user: { name: "Ama Owusu", title: "MD" },
    role: "prescriber",
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useIsOffline", () => ({
  useIsOffline: () => false,
}));

vi.mock("@/lib/query/hooks/useOutbox", () => ({
  usePendingOutbox: () => ({ data: [] }),
}));

afterEach(() => cleanup());

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
