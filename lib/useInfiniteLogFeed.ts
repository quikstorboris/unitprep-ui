"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export type LogFeedResult<TEntry> =
  | { kind: "ok"; entries: TEntry[] }
  | { kind: "error"; message: string };

interface UseInfiniteLogFeedResult<TEntry> {
  entries: TEntry[];
  loading: boolean;
  loadingMore: boolean;
  loadError: string | null;
  exhausted: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
}

/**
 * Keyset-paginated, lazy-loaded-on-scroll log feed -- the shared shape
 * behind Security Logs and Activity Logs: fetch a page, watch an
 * IntersectionObserver sentinel at the list's end, fetch the next page
 * (keyed off the last entry's own cursor) once it scrolls near view.
 * `query` already closes over whatever filters are active on the
 * calling page and returns its own ok/error result (matching the
 * `AuthResult` convention the underlying API calls use); this hook only
 * owns the fetch/paging state machine, not what's being filtered.
 */
export function useInfiniteLogFeed<TEntry, TCursor>(
  query: (beforeCursor?: TCursor) => Promise<LogFeedResult<TEntry>>,
  getCursor: (entry: TEntry) => TCursor,
  pageSize: number
): UseInfiniteLogFeedResult<TEntry> {
  const [entries, setEntries] = useState<TEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const result = await query(undefined);
    setLoading(false);

    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setEntries(result.entries);
    setExhausted(result.entries.length < pageSize);
  }, [query, pageSize]);

  // Deferred via queueMicrotask -- same reasoning as the Users page's own
  // load effect: the lint rule flags any setState reachable from the
  // effect body's synchronous execution, even one only reached after an
  // await.
  useEffect(() => {
    queueMicrotask(() => {
      loadFirstPage();
    });
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    const last = entries[entries.length - 1];
    if (last === undefined) return;

    setLoadingMore(true);
    const result = await query(getCursor(last));
    setLoadingMore(false);

    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setEntries((current) => [...current, ...result.entries]);
    setExhausted(result.entries.length < pageSize);
  }, [entries, query, getCursor, pageSize]);

  // Lazy-load: an IntersectionObserver on a sentinel at the list's end,
  // rather than a "Load more" button. Re-created whenever
  // exhausted/loadingMore/loadMore itself changes (loadMore's own
  // identity changes on every successful fetch, since it closes over
  // `entries`) -- cheap to tear down and reconnect, and simpler than
  // threading a ref through to dodge that.
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (exhausted || loadingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([sentinelEntry]) => {
        if (sentinelEntry?.isIntersecting) {
          loadMore();
        }
      },
      // Fires a bit before the sentinel is actually on screen, so the
      // next page is usually ready by the time the admin scrolls to see it.
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [exhausted, loadingMore, loadMore]);

  return { entries, loading, loadingMore, loadError, exhausted, sentinelRef };
}
