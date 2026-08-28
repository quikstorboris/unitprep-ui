"use client";

import { useEffect, useState } from "react";

import {
  listDropboxFolder,
  type DropboxEntry,
} from "@/lib/dropbox";

interface DropboxFolderPickerProps {
  /** Currently selected path, shown read-only until "Browse" is opened. */
  value: string;
  onChange: (path: string) => void;
}

/**
 * Inline Dropbox folder browser -- navigate by clicking a subfolder,
 * "Up" to go back, "Select this folder" to commit. Starts browsing at
 * `value` if one is already set (editing an existing selection), or at
 * the server's configured root otherwise (creating a client for the
 * first time should land the user among the top-level client folders,
 * not pre-guess a facility inside one of them).
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

  useEffect(() => {
    if (!open) return;

    // Re-browse from `value` (or the root) every time the picker is
    // opened, rather than resuming wherever it was last left inside a
    // single session -- opening it fresh each time is easier to reason
    // about than persisting scroll/navigation state.
    load(value || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          onClick={() => setOpen(true)}
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
          disabled={loading || !currentPath}
          className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↑ Up
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {loading ? (
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

      <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={!currentPath}
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
  );
}
