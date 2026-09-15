"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Checkbox-list-with-search dropdown for picking a subset of a small,
 * known option set. Promoted from `components/audit/EventTypeMultiSelect.tsx`
 * (2026-09-11) so the Audit Logs event-type filter and the Clients
 * directory's four checkbox filters (Implementation Manager, Sales Rep,
 * State, Previous PMS) share one implementation instead of drifting
 * copies of the same behavior -- a mechanical generalization
 * (string-only options became `{value, label}` pairs, and the
 * event-specific "events" wording became the `noun` prop), not a
 * behavior redesign.
 *
 * `components/audit/UserMultiSelect.tsx` is a related but genuinely
 * different pattern (fuzzy search-to-chips over a large user list, plus
 * a raw-UUID escape hatch) and stays its own component -- it was never
 * folded into this one.
 *
 * Keyboard-navigable (arrow up/down to move the highlight, Enter to
 * toggle the highlighted checkbox, Escape to close) as well as click.
 * Enter *toggles* rather than selecting-and-closing: this list is a set
 * of independent on/off switches, not a pick-one-then-done combobox, so
 * closing on every Enter would undo the point of being able to check
 * several in a row.
 */
export interface MultiSelectOption {
  value: string;
  label: string;
  /** Extra terms the search box should also match against besides
   * `label` -- e.g. a state option labeled "California" carrying
   * `["CA"]` so typing the postal abbreviation still finds it, even
   * though the displayed/selected value is the full name. */
  keywords?: string[];
}

export interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Plural noun used in the trigger's summary text and the "no
   * matches" message (e.g. "events", "states", "reps") -- kept a prop
   * rather than hardcoded so this one component reads naturally in
   * every filter it backs. */
  noun?: string;
  /** Matches the width of whatever filter control sits next to this one
   * -- callers own layout, this owns behaviour. */
  className?: string;
}

const triggerClass =
  "flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-100 focus:border-blue-500 focus:outline-none";

const panelInputClass =
  "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const panelButtonClass =
  "rounded px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800";

function summaryLabel(selected: string[], total: number, noun: string): string {
  if (total === 0) return `No ${noun} available`;
  if (selected.length === total) return `All ${noun} (${total})`;
  if (selected.length === 0) return `No ${noun} selected`;
  return `${selected.length} of ${total} ${noun}`;
}

export default function MultiSelectDropdown({
  options,
  selected,
  onChange,
  noun = "items",
  className,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLLabelElement | null>>([]);

  // Closes on an outside click -- the one piece of dropdown behaviour with
  // no HTML primitive to lean on, unlike <select> or <details>, neither of
  // which supports a checkbox list with a search box inside.
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedSet = new Set(selected);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(normalizedSearch) ||
      (option.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(normalizedSearch))
  );

  useEffect(() => {
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((existing) => existing !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || visibleOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % visibleOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(
        (index) => (index - 1 + visibleOptions.length) % visibleOptions.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visibleOptions[highlightedIndex];
      if (option) toggle(option.value);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={triggerClass}
      >
        <span className="truncate">
          {summaryLabel(selected, options.length, noun)}
        </span>
        <span className="ml-2 text-slate-500">▾</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-[16rem] rounded border border-slate-700 bg-slate-900 p-2 shadow-lg">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              // Reset here, in the same event, rather than in a
              // useEffect keyed on `search` -- setState-in-effect causes
              // an extra cascading render for a change that's already
              // known at the point search itself changes.
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${noun}…`}
            className={`${panelInputClass} mb-2`}
          />

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onChange(options.map((option) => option.value))}
              className={panelButtonClass}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className={panelButtonClass}
            >
              Clear all
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {visibleOptions.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-500">
                No matching {noun}.
              </p>
            ) : (
              visibleOptions.map((option, index) => (
                <label
                  key={option.value}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 ${
                    index === highlightedIndex ? "bg-slate-800" : "hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.value)}
                    onChange={() => toggle(option.value)}
                    className="accent-blue-600"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
