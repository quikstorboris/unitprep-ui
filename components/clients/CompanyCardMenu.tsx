"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The kebab menu overlaid on each company button's corner in the
 * Clients directory grid -- holds the archive/unarchive/delete
 * affordances that used to be separate buttons inside each row of the
 * old `<ul>` list. A DOM sibling of the company button, not nested
 * inside it (see `CompanyDirectoryGrid`), so a click on the dots never
 * also triggers that button's navigate-to-client action -- normal DOM
 * hit-testing already guarantees that without needing
 * `stopPropagation()`. Styled with no border/background of its own so
 * it reads as part of the button's own corner, not a separate box next
 * to it.
 */
export interface CompanyCardMenuProps {
  companyName: string;
  archived: boolean;
  disabled: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

const triggerClass =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50";

const menuItemClass =
  "block w-full whitespace-nowrap rounded px-3 py-1.5 text-left text-sm transition-colors hover:bg-slate-700";

export default function CompanyCardMenu({
  companyName,
  archived,
  disabled,
  onArchive,
  onUnarchive,
  onDelete,
}: CompanyCardMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  function runAndClose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={`More actions for ${companyName}`}
        onClick={() => setOpen((value) => !value)}
        className={triggerClass}
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded border border-slate-700 bg-slate-800 p-1 shadow-lg">
          {archived ? (
            <button
              type="button"
              onClick={() => runAndClose(onUnarchive)}
              className={`${menuItemClass} text-slate-300`}
            >
              Unarchive
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runAndClose(onArchive)}
              className={`${menuItemClass} text-slate-300`}
            >
              Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => runAndClose(onDelete)}
            className={`${menuItemClass} text-red-400`}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
