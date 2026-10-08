"use client";

import { useState } from "react";

import { EntryList } from "./dropbox-picker/EntryList";
import { SearchResultsList } from "./dropbox-picker/SearchResultsList";
import { useDropboxBrowse } from "./dropbox-picker/useDropboxBrowse";
import { useDropboxSearch } from "./dropbox-picker/useDropboxSearch";

interface DropboxFolderPickerProps {
  /** Currently selected path, shown read-only until "Browse" is opened. */
  value: string;
  onChange: (path: string) => void;
  /**
   * "select-folder" (default): browse-and-commit, exactly today's
   * client-setup behavior -- files are listed but not selectable, a
   * separate "Select this folder" button commits `currentPath`.
   * "select-file": also lists files (via `includeFiles`), and clicking
   * one commits it immediately -- there's no notion of "select the
   * current folder" when picking a specific file, e.g. Dedup's "Import
   * from Dropbox".
   */
  mode?: "select-folder" | "select-file";
  /**
   * Where to start browsing when `value` is empty -- e.g. a client's
   * already-known `dropboxPath`, so the picker doesn't force navigating
   * all the way down from the QMS Onboarding root every time. Ignored
   * once `value` is set (editing an existing selection always resumes
   * there instead).
   */
  initialPath?: string;
  /**
   * Whether the listing includes files, independent of `mode` --
   * defaults to `mode === "select-file"` (both existing callers' actual
   * need: a folder picker has never shown files, a file picker always
   * has). Unit Groups needs the third combination `mode="select-folder"`
   * still commits a folder, but a manager needs to actually see the
   * files inside it to confirm they're in the right place -- confirmed
   * live 2026-09-04 that a real Preliminary Data folder's files were
   * silently invisible without this, even though they exist. A visible
   * file row in folder mode renders as a plain, non-clickable label (see
   * `EntryList`) -- selecting still only ever commits a folder.
   */
  showFiles?: boolean;
}

/**
 * Inline Dropbox folder browser -- navigate by clicking a subfolder's
 * name, "Up" to go back. In "select-folder" mode, each folder row also
 * has its own "Select" action to commit that exact folder without
 * entering it, plus a "Select this folder" button to commit whichever
 * folder is currently open. Starts browsing at `value` if one is already
 * set (editing an existing selection), or at the server's configured
 * root otherwise (creating a client for the first time should land the
 * user among the top-level client folders, not pre-guess a facility
 * inside one of them).
 *
 * Also supports searching by name across the whole tree (not just the
 * currently browsed folder) -- important because a facility's name is
 * often unrelated to its client's corporate name (a DBA, a geographic
 * location), so someone who only knows the facility name would never
 * find it browsing client-by-client.
 *
 * Browsing and searching live in `dropbox-picker/` (`useDropboxBrowse`,
 * `useDropboxSearch`); this component owns open/closed and what commits.
 */
export function DropboxFolderPicker({
  value,
  onChange,
  mode = "select-folder",
  initialPath,
  showFiles,
}: DropboxFolderPickerProps) {
  const isFileMode = mode === "select-file";
  const includeFiles = showFiles ?? isFileMode;
  const [open, setOpen] = useState(false);
  const browse = useDropboxBrowse({ open, value, initialPath, isFileMode, includeFiles });
  const search = useDropboxSearch();
  const { currentPath, loading, error } = browse;

  function commit(path: string) {
    onChange(path);
    setOpen(false);
  }

  function goToSearchResult(path: string) {
    search.clearQuery();
    browse.load(path);
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm text-slate-300">
          {value || (isFileMode ? "No file selected" : "No folder selected")}
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              search.clearQuery();
              setOpen(true);
            }}
            className="rounded border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            Browse…
          </button>
        </div>
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
          onClick={browse.goUp}
          disabled={loading || !currentPath || search.isActive}
          className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↑ Up
        </button>
      </div>

      {includeFiles && !isFileMode && (
        // Files are listed here purely so a manager can confirm the
        // right ones are in this folder -- they aren't individually
        // selectable (see the plain-label branch in `EntryList`), which
        // reads as a bug unless it's called out up front.
        <p className="text-xs text-slate-400">
          Files are shown for reference only — select a{" "}
          <strong className="font-bold text-red-500">folder</strong>, not a
          file.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {search.isActive ? (
        <SearchResultsList
          results={search.results}
          searching={search.searching}
          error={search.error}
          rootPath={browse.rootPath}
          onSelect={goToSearchResult}
        />
      ) : loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <EntryList
          entries={browse.entries}
          error={error}
          isFileMode={isFileMode}
          onOpenFolder={browse.load}
          onCommit={commit}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
        <input
          type="text"
          value={search.query}
          onChange={(e) => search.changeQuery(e.target.value)}
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

          {!isFileMode && (
            <button
              type="button"
              disabled={!currentPath || search.isActive}
              title={
                search.isActive
                  ? "Click a search result to navigate there first"
                  : undefined
              }
              onClick={() => {
                if (!currentPath) return;
                commit(currentPath);
              }}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select this folder
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
