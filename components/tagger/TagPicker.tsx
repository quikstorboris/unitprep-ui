"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { QmsTag } from "@/lib/clientOps";

/**
 * Single-select searchable dropdown for choosing one QMS tag out of the
 * full catalog (~120+ rows -- a plain `<select>` is unusable at that
 * count). Same keyboard-navigable search-to-highlight pattern as
 * UserMultiSelect (arrow up/down, Enter, Escape, click), adapted for
 * single-select: no chips, the current value renders as a button that
 * opens the search, and picking a result replaces the value and closes
 * immediately rather than adding to a list.
 */
export interface TagPickerProps {
  tags: QmsTag[];
  value: string;
  onChange: (tagKey: string) => void;
  className?: string;
}

const inputClass =
  "w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

function matchesQuery(tag: QmsTag, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    tag.tag_key.toLowerCase().includes(needle) ||
    tag.label.toLowerCase().includes(needle)
  );
}

export default function TagPicker({
  tags,
  value,
  onChange,
  className,
}: TagPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const currentTag = useMemo(
    () => tags.find((tag) => tag.tag_key === value),
    [tags, value]
  );

  const matches = useMemo(
    () =>
      tags
        .filter((tag) => tag.is_active && matchesQuery(tag, search))
        .slice(0, 8),
    [tags, search]
  );

  function openPicker() {
    setSearch("");
    setHighlightedIndex(0);
    setOpen(true);
    // Deferred to the next tick so the input actually exists to focus --
    // it only mounts once `open` becomes true.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function selectTag(tag: QmsTag) {
    onChange(tag.tag_key);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const tag = matches[highlightedIndex];
      if (tag) selectTag(tag);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPicker}
        className={`rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-left text-sm text-slate-100 hover:border-blue-500 ${className ?? ""}`}
      >
        <span className="font-mono">{value}</span>
        {currentTag && (
          <span className="ml-2 text-slate-400">{currentTag.label}</span>
        )}
      </button>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search by tag key or label…"
        className={inputClass}
      />

      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded border border-slate-700 bg-slate-900 p-1 shadow-lg">
          {matches.map((tag, index) => {
            const highlighted = index === highlightedIndex;
            return (
              <button
                key={tag.tag_key}
                type="button"
                onClick={() => selectTag(tag)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block w-full rounded px-2 py-1 text-left ${
                  highlighted ? "bg-slate-800" : "hover:bg-slate-800"
                }`}
              >
                <div className="font-mono text-sm text-slate-200">{tag.tag_key}</div>
                <div className="text-xs text-slate-500">{tag.label}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
