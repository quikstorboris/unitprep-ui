"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Checkbox-list-with-search dropdown for picking a subset of audit event
 * types. Shared by the inline Audit Logs filter bar and the audit-log
 * export filters page -- one component, not two independently-drifting
 * copies of the same idea.
 *
 * `allEventTypes` is expected to come from `listAuditLogEventTypes()`
 * (the backend's own canonical list), not a hand-maintained copy.
 */
export interface EventTypeMultiSelectProps {
  allEventTypes: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Matches the width of whatever filter control sits next to this one
   * (e.g. the User ID input) -- callers own layout, this owns behaviour. */
  className?: string;
}

const triggerClass =
  "flex w-full items-center justify-between rounded border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-100 focus:border-blue-500 focus:outline-none";

const panelInputClass =
  "w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const panelButtonClass =
  "rounded px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800";

function summaryLabel(selected: string[], total: number): string {
  if (total === 0) return "No events available";
  if (selected.length === total) return `All events (${total})`;
  if (selected.length === 0) return "No events selected";
  return `${selected.length} of ${total} events`;
}

export default function EventTypeMultiSelect({
  allEventTypes,
  selected,
  onChange,
  className,
}: EventTypeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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
  const visibleEventTypes = allEventTypes.filter((eventType) =>
    eventType.toLowerCase().includes(search.trim().toLowerCase())
  );

  function toggle(eventType: string) {
    if (selectedSet.has(eventType)) {
      onChange(selected.filter((value) => value !== eventType));
    } else {
      onChange([...selected, eventType]);
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
          {summaryLabel(selected, allEventTypes.length)}
        </span>
        <span className="ml-2 text-slate-500">▾</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-[16rem] rounded border border-slate-700 bg-slate-900 p-2 shadow-lg">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events…"
            className={`${panelInputClass} mb-2`}
          />

          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onChange(allEventTypes)}
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
            {visibleEventTypes.length === 0 ? (
              <p className="px-2 py-1 text-xs text-slate-500">
                No matching events.
              </p>
            ) : (
              visibleEventTypes.map((eventType) => (
                <label
                  key={eventType}
                  className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(eventType)}
                    onChange={() => toggle(eventType)}
                    className="accent-blue-600"
                  />
                  <span className="truncate">{eventType}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
