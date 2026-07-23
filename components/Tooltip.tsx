"use client";

import { useState } from "react";

interface TooltipProps {
  text: string;
}

/**
 * A small ❓ icon that shows `text` on hover or keyboard focus. No new
 * dependency — this codebase has no existing tooltip component (only
 * one is needed today, for company-name mismatches), so a minimal
 * hover/focus-toggled popover is simplest. `title` is also set as a
 * native fallback for anyone whose input method doesn't trigger the
 * custom popover.
 */
export default function Tooltip({ text }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative ml-1 inline-block">
      <button
        type="button"
        title={text}
        aria-label="Why does this matter?"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[10px] font-bold text-slate-200 hover:bg-slate-500"
      >
        ?
      </button>

      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded border border-slate-600 bg-slate-800 p-2 text-xs font-normal text-slate-200 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
