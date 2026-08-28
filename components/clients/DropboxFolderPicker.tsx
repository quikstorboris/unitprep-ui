"use client";

import { useEffect, useState } from "react";

import {
  listDropboxFolder,
  searchDropboxFolders,
  type DropboxEntry,
} from "@/lib/dropbox";

interface DropboxFolderPickerProps {
  /** Currently selected path, shown read-only until "Browse" is opened. */
  value: string;
  onChange: (path: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

/** One search hit's breadcrumb segments, relative to the configured
 * root -- e.g. ["Prairie Enterprises LLC", "Highway 20 Self Storage"]
 * for a facility match, or just ["Prairie Enterprises LLC"] for a
 * client-level one. Falls back to the bare name if `rootPath` hasn't
 * loaded yet (a brief race on first open), rather than showing nothing. */
function breadcrumbFor(
  pathDisplay: string,
  rootPath: string | null
): string[] {
  if (!rootPath || !pathDisplay.startsWith(rootPath)) {
    return [pathDisplay.split("/").filter(Boolean).pop() ?? pathDisplay];
  }

  return pathDisplay
    .slice(rootPath.length)
    .split("/")
    .filter(Boolean);
}

/**
 * Inline Dropbox folder browser -- navigate by clicking a subfolder,
 * "Up" to go back, "Select this folder" to commit. Starts browsing at
 * `value` if one is already set (editing an existing selection), or at
 * the server's configured root otherwise (creating a client for the
 * first time should land the user among the top-level client folders,
 * not pre-guess a facility inside one of them).
 *
 * Also supports searching by name across the whole tree (not just the
 * currently browsed folder) -- important because a facility's name is
 * often unrelated to its client's corporate name (a DBA, a geographic
 * location), so someone who only knows the facility name would never
 * find it browsing client-by-client.
 */
export function DropboxFolderPicker({
  value,
  onChange,
}: DropboxFolderPickerProps) {
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Captured once per open, independent of `currentPath` -- needed to
  // turn a search hit's absolute path into "Client / Facility"-style
  // breadcrumb segments regardless of where browsing currently is.
  const [rootPath, setRootPath] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DropboxEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const isSearchActive = searchQuery.trim().length >= SEARCH_MIN_CHARS;

  useEffect(() => {
    if (!open) return;

    // Re-browse from `value` (or the root) every time the picker is
    // opened, rather than resuming wherever it was last left inside a
    // single session -- opening it fresh each time is easier to reason
    // about than persisting scroll/navigation state.
    load(value || undefined);

    // A second, independent call -- `load` above may resolve `value`,
    // not the root, so this is the only reliable way to learn the root
    // path string for breadcrumb math regardless of where browsing
    // starts.
    listDropboxFolder().then((result) => {
      if (result.kind === "ok") setRootPath(result.data.path);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    // The empty-query reset lives in the input's onChange below, not
    // here -- setting state synchronously in an effect body triggers an
    // avoidable cascading render (react-hooks/set-state-in-effect); this
    // effect only ever schedules the debounced fetch callback itself.
    if (!isSearchActive) return;

    const timeout = setTimeout(async () => {
      setSearching(true);

      const result = await searchDropboxFolders(searchQuery);

      setSearching(false);

      if (result.kind !== "ok") {
        setSearchError(result.message);
        return;
      }

      setSearchError(null);
      setSearchResults(result.data.entries);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function load(path: string | undefined) {
    setLoading(true);
    setError(null);

    const result = await listDropboxFolder(path);

    setLoading(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setCurrentPath(result.data.path);
    setEntries(result.data.entries);
  }

  function goToSearchResult(path: string) {
    setSearchQuery("");
    load(path);
  }

  function goUp() {
    if (!currentPath) return;

    const segments = currentPath.split("/");
    segments.pop();
    const parent = segments.join("/");

    // Going up past the root the backend already resolved us to isn't
    // meaningful -- the backend would reject it anyway (outside the
    // configured root), so just re-load the root instead of guessing.
    load(parent || undefined);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          {value || "No folder selected"}
        </span>

        <button
          type="button"
          onClick={() => {
            setSearchQuery("");
            setOpen(true);
          }}
          className="rounded border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Browse…
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-xs text-slate-400">
          {currentPath ?? "Loading…"}
        </span>

        <button
          type="button"
          onClick={goUp}
          disabled={loading || !currentPath || isSearchActive}
          className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↑ Up
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {isSearchActive ? (
        <>
          {searchError && (
            <p className="text-sm text-red-400">{searchError}</p>
          )}

          {searching ? (
            <p className="text-sm text-slate-500">Searching…</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {searchResults.length === 0 && !searchError && (
                <li className="text-sm text-slate-500">
                  No matching folders.
                </li>
              )}

              {searchResults.map((entry) => (
                <li key={entry.path_display}>
                  <button
                    type="button"
                    onClick={() => goToSearchResult(entry.path_display)}
                    className="w-full rounded px-2 py-1 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                  >
                    📁{" "}
                    {breadcrumbFor(entry.path_display, rootPath).map(
                      (segment, i, segments) => (
                        <span key={i}>
                          {i > 0 && (
                            <span className="text-slate-500"> ▸ </span>
                          )}
                          <span
                            className={
                              i === segments.length - 1
                                ? "font-medium"
                                : "text-slate-400"
                            }
                          >
                            {segment}
                          </span>
                        </span>
                      )
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {entries.length === 0 && !error && (
            <li className="text-sm text-slate-500">
              This folder is empty.
            </li>
          )}

          {entries.map((entry) => (
            <li key={entry.path_display}>
              {entry.is_folder ? (
                <button
                  type="button"
                  onClick={() => load(entry.path_display)}
                  className="w-full rounded px-2 py-1 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
                >
                  📁 {entry.name}
                </button>
              ) : (
                <span className="block px-2 py-1 text-sm text-slate-600">
                  {entry.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const next = e.target.value;
            setSearchQuery(next);

            // Cleared/too-short here, in the handler that changed the
            // text, rather than in the debounce effect below reacting
            // to it -- same reasoning as the Browse… button above.
            if (next.trim().length < SEARCH_MIN_CHARS) {
              setSearchResults([]);
              setSearchError(null);
            }
          }}
          placeholder="Search folders…"
          className="w-48 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500"
        />

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!currentPath || isSearchActive}
            title={
              isSearchActive
                ? "Click a search result to navigate there first"
                : undefined
            }
            onClick={() => {
              if (!currentPath) return;
              onChange(currentPath);
              setOpen(false);
            }}
            className="rounded bg-blue-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Select this folder
          </button>
        </div>
      </div>
    </div>
  );
}
