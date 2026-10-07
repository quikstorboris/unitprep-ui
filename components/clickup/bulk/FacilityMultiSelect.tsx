"use client";

import { useEffect, useRef, useState } from "react";

const linkButton = "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

export interface FacilityOption {
  id: string;
  name: string;
  checked: boolean;
  /** Why this facility cannot be ticked, when it cannot. */
  disabledReason?: string;
  /** A note shown beside the name (e.g. no matching task found). */
  hint?: string;
}

/**
 * A dropdown of facilities, each with a checkbox, for choosing where a
 * comment goes. The button says how many are chosen; the list closes on an
 * outside click or Escape. Nothing is chosen until the person ticks it.
 */
export default function FacilityMultiSelect({
  options,
  onToggle,
  onSetAll,
}: {
  options: FacilityOption[];
  onToggle: (id: string) => void;
  onSetAll: (checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = options.filter((option) => option.checked).length;
  const label =
    selected === 0 ? "Select facilities" : `${selected} of ${options.length} ${options.length === 1 ? "facility" : "facilities"} selected`;

  return (
    <div ref={container} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-w-56 items-center justify-between gap-3 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-xs text-slate-400">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="group"
          aria-label="Facilities to copy to"
          className="absolute left-0 z-20 mt-1 w-80 max-w-[90vw] rounded border border-slate-700 bg-slate-900 p-2 shadow-lg"
        >
          <div className="mb-2 flex items-center gap-3 border-b border-slate-800 pb-2">
            <button type="button" onClick={() => onSetAll(true)} className={linkButton}>
              Select all
            </button>
            <button type="button" onClick={() => onSetAll(false)} className={linkButton}>
              Select none
            </button>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {options.map((option) => (
              <li key={option.id}>
                <label
                  title={option.disabledReason}
                  className={`flex items-start gap-2 rounded px-1 py-1 text-sm ${
                    option.disabledReason ? "cursor-not-allowed text-slate-500" : "cursor-pointer text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={option.checked}
                    disabled={Boolean(option.disabledReason)}
                    onChange={() => onToggle(option.id)}
                    aria-label={`Copy to ${option.name}`}
                    className="mt-1"
                  />
                  <span className="min-w-0 break-words">
                    {option.name}
                    {option.hint && <span className="block text-xs text-slate-500">{option.hint}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
