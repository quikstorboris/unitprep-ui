"use client";

import { useEffect, useState } from "react";

import {
  dropboxParentFolder,
  listDropboxFolder,
  type DropboxEntry,
} from "@/lib/dropbox";
import { useLatestRequest } from "@/lib/useLatestRequest";

interface UseDropboxBrowseOptions {
  open: boolean;
  value: string;
  initialPath: string | undefined;
  isFileMode: boolean;
  includeFiles: boolean;
}

/**
 * Folder navigation for the picker: the current listing, `load(path)`
 * and `goUp()`. Re-browses from `value` (or `initialPath`, or the root)
 * every time the picker is opened.
 */
export function useDropboxBrowse({
  open,
  value,
  initialPath,
  isFileMode,
  includeFiles,
}: UseDropboxBrowseOptions) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Captured once per open, independent of `currentPath` -- needed to
  // turn a search hit's absolute path into "Client / Facility"-style
  // breadcrumb segments regardless of where browsing currently is.
  const [rootPath, setRootPath] = useState<string | null>(null);

  // A folder listing answers independently of a search (see the search hook).
  const beginLoadRequest = useLatestRequest();

  useEffect(() => {
    if (!open) return;

    // Re-browse from `value` (or `initialPath`, or the root) every time
    // the picker is opened, rather than resuming wherever it was last
    // left inside a single session -- opening it fresh each time is
    // easier to reason about than persisting scroll/navigation state.
    // In file-select mode, `value` (once set) is a FILE path, not a
    // folder -- listing it directly 409s ("path/not_folder"), so this
    // starts from its containing folder instead (confirmed live
    // 2026-09-04: reopening the picker after picking a file threw
    // exactly that error).
    const startPath = isFileMode && value ? dropboxParentFolder(value) : value;
    load(startPath || initialPath || undefined);

    // A second, independent call -- `load` above may resolve `value`,
    // not the root, so this is the only reliable way to learn the root
    // path string for breadcrumb math regardless of where browsing
    // starts.
    listDropboxFolder().then((result) => {
      if (result.kind === "ok") setRootPath(result.data.path);
    });
    // `initialPath` deliberately IS a dependency here (unlike `value`,
    // `isFileMode`, `load`) -- a caller that resolves it asynchronously
    // (Dedup's facility dropdown: pick a facility, then fetch its real
    // Dropbox folder) can easily still be `undefined` at the exact
    // instant this picker first opens, and this effect otherwise only
    // ever runs once per `open` transition. Confirmed live 2026-09-04:
    // without this, a facility resolved a moment after the picker
    // opened was silently ignored and browsing stayed at the root.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPath]);

  async function load(path: string | undefined) {
    const signal = beginLoadRequest();
    setLoading(true);
    setError(null);

    const result = await listDropboxFolder(path, includeFiles, { signal });
    if (signal.aborted) return;

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

  return { currentPath, entries, loading, error, rootPath, load, goUp };
}
