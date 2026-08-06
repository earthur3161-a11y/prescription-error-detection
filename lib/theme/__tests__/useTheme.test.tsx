import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { useTheme } from "../useTheme";

// This jsdom environment doesn't provide a working window.localStorage (real
// browsers always do — confirmed this is a test-environment gap, not a
// production one, before reaching for this rather than chasing jsdom/vitest
// internals further). A minimal in-memory stand-in, scoped to this file.
function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: memoryStorage,
    writable: true,
    configurable: true,
  });
}

beforeAll(() => {
  installMemoryLocalStorage();
});

function Probe({ id = "probe" }: { id?: string }) {
  const { theme, toggle, mounted } = useTheme();
  return (
    <button data-testid={id} onClick={toggle}>
      {mounted ? theme : "unmounted"}
    </button>
  );
}

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  window.localStorage.clear();
});

describe("useTheme", () => {
  it("reads the real value already applied to the DOM (by the no-FOUC inline script) once mounted", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("dark");
  });

  it("defaults to light when no data-theme attribute is present", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("light");
  });

  it("toggle() actually updates what's rendered — the real bug risk with a no-op subscribe", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("light");

    act(() => {
      fireEvent.click(screen.getByTestId("probe"));
    });

    expect(screen.getByTestId("probe")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists the choice to window.localStorage", () => {
    render(<Probe />);
    act(() => {
      fireEvent.click(screen.getByTestId("probe"));
    });
    expect(window.localStorage.getItem("mediguard-theme")).toBe("dark");
  });

  it("keeps two simultaneous consumers in sync when one of them toggles", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(
      <>
        <Probe id="a" />
        <Probe id="b" />
      </>
    );
    expect(screen.getByTestId("a")).toHaveTextContent("light");
    expect(screen.getByTestId("b")).toHaveTextContent("light");

    act(() => {
      fireEvent.click(screen.getByTestId("a"));
    });

    expect(screen.getByTestId("a")).toHaveTextContent("dark");
    expect(screen.getByTestId("b")).toHaveTextContent("dark");
  });
});
