"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ComboboxProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  onQueryChange: (query: string) => void;
  query: string;
  placeholder?: string;
  loading?: boolean;
  emptyMessage?: string;
  renderItem?: (item: T) => ReactNode;
  className?: string;
}

/**
 * A hand-rolled ARIA combobox (WAI-ARIA APG pattern) so drug/patient search
 * is fully keyboard-operable without pulling in a component library.
 */
export function Combobox<T>({
  items,
  getKey,
  getLabel,
  onSelect,
  onQueryChange,
  query,
  placeholder,
  loading,
  emptyMessage = "No results found.",
  renderItem,
  className,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      setActiveIndex(0);
      e.preventDefault();
      return;
    }
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) {
        onSelect(item);
        setOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
        />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-border-strong bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-subtle">Searching…</li>
          )}
          {!loading && items.length === 0 && (
            <li className="px-3 py-2 text-sm text-subtle">{emptyMessage}</li>
          )}
          {!loading &&
            items.map((item, index) => (
              <li
                key={getKey(item)}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item);
                  setOpen(false);
                  setActiveIndex(-1);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  index === activeIndex ? "bg-brand-subtle text-brand" : "text-secondary"
                )}
              >
                {renderItem ? renderItem(item) : getLabel(item)}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
