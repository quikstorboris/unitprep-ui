"use client";

import type { DropboxEntry } from "@/lib/dropbox";

/** The browsed folder's rows: folders to enter (and, in folder mode, to
 * select directly), files to pick (file mode) or just read (folder mode
 * with `showFiles`). */
export function EntryList({
  entries,
  error,
  isFileMode,
  onOpenFolder,
  onCommit,
}: {
  entries: DropboxEntry[];
  error: string | null;
  isFileMode: boolean;
  onOpenFolder: (path: string) => void;
  /** Commits a path and closes the picker. */
  onCommit: (path: string) => void;
}) {
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {entries.length === 0 && !error && (
        <li className="text-sm text-slate-500">This folder is empty.</li>
      )}

      {entries.map((entry) => (
        <li key={entry.path_display}>
          {entry.is_folder ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenFolder(entry.path_display)}
                className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
              >
                📁 {entry.name}
              </button>

              {/* Selecting a folder can't require entering it first --
                  that only lets you commit whatever folder you
                  currently happen to be standing in (the bottom
                  "Select this folder" button, for that one case).
                  This is the direct "yes, this exact row" action a
                  folder picker needs -- without it, the only way to
                  stop drilling down was to descend one level too far,
                  then walk back out, which read as an actual bug,
                  not just an awkward extra click. */}
              {!isFileMode && (
                <button
                  type="button"
                  onClick={() => onCommit(entry.path_display)}
                  className="shrink-0 rounded border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
                >
                  Select
                </button>
              )}
            </div>
          ) : isFileMode ? (
            // Clicking a file commits it immediately -- there's no
            // separate "Select this folder"-style confirm step for a
            // file pick, since the click itself already names the
            // exact thing being selected.
            <button
              type="button"
              onClick={() => onCommit(entry.path_display)}
              className="w-full rounded px-2 py-1 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              📄 {entry.name}
            </button>
          ) : (
            <span className="block px-2 py-1 text-sm text-slate-600">
              {entry.name}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
