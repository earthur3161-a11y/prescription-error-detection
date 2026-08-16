// This project's jsdom test environment doesn't provide a working
// window.localStorage (real browsers always do — confirmed this is a
// test-environment gap, not a production one; see lib/theme/useTheme.ts's
// own test, the first place this was worked around). A minimal in-memory
// stand-in, shared by any test file that exercises localStorage-backed
// behavior.
export function installMemoryLocalStorage(): void {
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
