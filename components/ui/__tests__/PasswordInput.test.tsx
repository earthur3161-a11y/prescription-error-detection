import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PasswordInput } from "../PasswordInput";

afterEach(() => cleanup());

describe("PasswordInput", () => {
  it("starts masked, with the toggle offering to show it", () => {
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("toggles to visible on click, then back to masked, updating both the input type and the button's own label", () => {
    render(<PasswordInput aria-label="Password" />);
    const input = screen.getByLabelText("Password");
    const toggle = screen.getByRole("button", { name: "Show password" });

    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });

  it("is a real <button type=\"button\">, not a div — so it's keyboard-reachable via Tab and activatable via Enter/Space by native browser semantics, not custom key handling", () => {
    render(<PasswordInput aria-label="Password" />);
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("type", "button");
  });

  it("never submits the surrounding form — type=\"button\" specifically prevents that, unlike an unset/default type inside a <form>", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Password" />
      </form>
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("forwards value, onChange, autoComplete, and required to the real input unchanged — a drop-in replacement for Input", () => {
    const onChange = vi.fn();
    render(
      <PasswordInput aria-label="Password" value="secret123" onChange={onChange} autoComplete="current-password" required />
    );
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.value).toBe("secret123");
    expect(input).toHaveAttribute("autoComplete", "current-password");
    expect(input).toBeRequired();

    fireEvent.change(input, { target: { value: "secret1234" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("keeps the toggle in control of type even if a caller smuggles one in at runtime (TS blocks it at the type level via Omit<..., 'type'>, but Vitest doesn't type-check — this proves the runtime guarantee independently)", () => {
    // @ts-expect-error -- type is intentionally not an accepted prop on PasswordInput.
    render(<PasswordInput aria-label="Password" type="text" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });
});
