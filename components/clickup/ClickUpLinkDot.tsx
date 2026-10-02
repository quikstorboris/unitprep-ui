"use client";

import { useState } from "react";

/**
 * The dot beside the ClickUp heading: green when the facility is linked
 * to a ClickUp list, red when it is not (never linked, or unlinked).
 * Deliberately says nothing about whether the *viewer* can reach ClickUp
 * -- that is what the nav's ClickUp dot is for.
 *
 * Hovering (or focusing) it shows a bubble spelling out the state, so
 * the colour never has to be decoded on its own.
 */
export default function ClickUpLinkDot({ linked }: { linked: boolean }) {
  const [visible, setVisible] = useState(false);
  const label = linked ? "Facility linked to ClickUp" : "Facility not linked to ClickUp";

  return (
    <span className="relative inline-flex items-center">
      <span
        role="img"
        aria-label={label}
        tabIndex={0}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${linked ? "bg-green-500" : "bg-red-500"}`}
      />

      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-normal text-slate-200 shadow-lg"
        >
          {label}
        </span>
      )}
    </span>
  );
}
