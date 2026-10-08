"use client";

import type { DropboxEntry } from "@/lib/dropbox";

import { breadcrumbFor } from "./breadcrumbFor";

/** Search hits as "Client ▸ Facility" breadcrumb buttons. */
export function SearchResultsList({
  results,
  searching,
  error,
  rootPath,
  onSelect,
}: {
  results: DropboxEntry[];
  searching: boolean;
  error: string | null;
  rootPath: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {searching ? (
        <p className="text-sm text-slate-500">Searching…</p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {results.length === 0 && !error && (
            <li className="text-sm text-slate-500">No matching folders.</li>
          )}

          {results.map((entry) => (
            <li key={entry.path_display}>
              <button
                type="button"
                onClick={() => onSelect(entry.path_display)}
                className="w-full rounded px-2 py-1 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800"
              >
                📁{" "}
                {breadcrumbFor(entry.path_display, rootPath).map(
                  (segment, i, segments) => (
                    <span key={i}>
                      {i > 0 && <span className="text-slate-500"> ▸ </span>}
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
  );
}
