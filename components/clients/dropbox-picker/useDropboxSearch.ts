"use client";

import { useEffect, useState } from "react";

import { searchDropboxFolders, type DropboxEntry } from "@/lib/dropbox";
import { useLatestRequest } from "@/lib/useLatestRequest";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

/**
 * Debounced folder search across the whole tree. `isActive` is true once
 * the query is long enough to search; while it is, the picker shows the
 * results instead of the browsed folder.
 */
export function useDropboxSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DropboxEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isActive = query.trim().length >= SEARCH_MIN_CHARS;
  const beginRequest = useLatestRequest();

  useEffect(() => {
    // The empty-query reset lives in `changeQuery` below, not here --
    // setting state synchronously in an effect body triggers an
    // avoidable cascading render (react-hooks/set-state-in-effect); this
    // effect only ever schedules the debounced fetch callback itself.
    if (!isActive) return;

    const timeout = setTimeout(async () => {
      const signal = beginRequest();
      setSearching(true);

      const result = await searchDropboxFolders(query, { signal });
      if (signal.aborted) return;

      setSearching(false);

      if (result.kind !== "ok") {
        setError(result.message);
        return;
      }

      setError(null);
      setResults(result.data.entries);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [isActive, query, beginRequest]);

  /** Typing: cleared/too-short text resets results here, in the handler
   * that changed the text, rather than in the debounce effect reacting
   * to it. */
  function changeQuery(next: string) {
    setQuery(next);

    if (next.trim().length < SEARCH_MIN_CHARS) {
      setResults([]);
      setError(null);
    }
  }

  /** Drops the query (leaves the last results hidden, as before). */
  function clearQuery() {
    setQuery("");
  }

  return { query, results, searching, error, isActive, changeQuery, clearQuery };
}
