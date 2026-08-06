"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { UserSummary } from "@/lib/auth";

/**
 * Fuzzy-search-to-chips multi-select for a User filter -- shared by the
 * audit-log export's filters page and the inline Audit Logs page's own
 * User filter (upgraded from a single-select to match). Also accepts a
 * directly-pasted UUID that doesn't match anyone in `users` (e.g. a
 * soft-deleted actor/target no longer in the admin's user list) via an
 * "Add UUID" option in the dropdown -- the inline page's original
 * single-select supported this and it would otherwise be a regression
 * to drop when upgrading to multi-select.
 *
 * Keyboard-navigable (arrow up/down to move the highlight, Enter to
 * select, Escape to close) as well as click. Boris asked for this
 * specifically here, and flagged it as a standing preference: keyboard
 * navigation for a dropdown-with-a-list is a UI/UX baseline expectation,
 * not a nice-to-have to add only when asked.
 */
export interface UserMultiSelectProps {
  users: UserSummary[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

const inputClass =
  "w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matchesQuery(user: UserSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return (
    user.id.toLowerCase().includes(needle) ||
    user.email.toLowerCase().includes(needle) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(needle)
  );
}

/** One row in the dropdown, whichever kind it is -- a single discriminated
 * list so keyboard highlighting has one flat sequence to move through,
 * rather than needing to reason about "index within matches" vs. "the
 * one add-UUID row" as two separate cases. */
type DropdownItem =
  | { kind: "user"; user: UserSummary }
  | { kind: "rawUuid"; id: string };

export default function UserMultiSelect({
  users,
  selected,
  onChange,
  className,
}: UserMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
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

  const selectedUsers = useMemo(
    () => users.filter((user) => selected.includes(user.id)),
    [users, selected]
  );

  // Selected ids with no matching user -- a directly-added UUID, or a
  // user who existed when this was selected but no longer does (e.g.
  // soft-deleted). Rendered as their own chip rather than silently
  // dropped, since removing a filter the admin explicitly set would be
  // more surprising than showing a raw UUID.
  const unresolvedSelectedIds = useMemo(
    () => selected.filter((id) => !users.some((user) => user.id === id)),
    [selected, users]
  );

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    return users
      .filter((user) => !selected.includes(user.id) && matchesQuery(user, search))
      .slice(0, 8);
  }, [users, selected, search]);

  const trimmedSearch = search.trim();
  const showAddRawUuid =
    UUID_PATTERN.test(trimmedSearch) &&
    !selected.includes(trimmedSearch) &&
    !users.some((user) => user.id.toLowerCase() === trimmedSearch.toLowerCase());

  const dropdownItems: DropdownItem[] = useMemo(() => {
    const items: DropdownItem[] = matches.map((user) => ({ kind: "user", user }));
    if (showAddRawUuid) items.push({ kind: "rawUuid", id: trimmedSearch });
    return items;
  }, [matches, showAddRawUuid, trimmedSearch]);

  function selectItem(item: DropdownItem) {
    onChange([...selected, item.kind === "user" ? item.user.id : item.id]);
    setSearch("");
    setOpen(false);
  }

  function removeId(id: string) {
    onChange(selected.filter((existing) => existing !== id));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || dropdownItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1) % dropdownItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(
        (index) => (index - 1 + dropdownItems.length) % dropdownItems.length
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = dropdownItems[highlightedIndex];
      if (item) selectItem(item);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        type="text"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          // Reset here, in the same event, rather than in a useEffect
          // keyed on `search` -- setState-in-effect causes an extra
          // cascading render for a change that's already known at the
          // point search itself changes.
          setHighlightedIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Start typing a name or email, or paste a UUID…"
        className={inputClass}
      />

      {open && dropdownItems.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 shadow-lg">
          {dropdownItems.map((item, index) => {
            const highlighted = index === highlightedIndex;
            const rowClass = `block w-full rounded px-2 py-1 text-left ${
              highlighted ? "bg-slate-800" : "hover:bg-slate-800"
            }`;

            if (item.kind === "user") {
              return (
                <button
                  key={item.user.id}
                  type="button"
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={rowClass}
                >
                  <div className="text-sm text-slate-200">
                    {item.user.first_name} {item.user.last_name}
                  </div>
                  <div className="text-xs text-slate-500">{item.user.email}</div>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectItem(item)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`${rowClass} font-mono text-xs text-slate-300`}
              >
                Add UUID: {item.id}
              </button>
            );
          })}
        </div>
      )}

      {(selectedUsers.length > 0 || unresolvedSelectedIds.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <span key={user.id} className={chipClass}>
              {user.first_name} {user.last_name}
              <button
                type="button"
                onClick={() => removeId(user.id)}
                aria-label={`Remove ${user.first_name} ${user.last_name}`}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </span>
          ))}
          {unresolvedSelectedIds.map((id) => (
            <span key={id} className={`${chipClass} font-mono`}>
              {id}
              <button
                type="button"
                onClick={() => removeId(id)}
                aria-label={`Remove ${id}`}
                className="text-slate-400 hover:text-slate-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
