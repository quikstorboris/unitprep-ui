"use client";

import { useEffect, useState } from "react";

import {
  API_URL,
  describeFetchError,
  errorMessageFrom,
} from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";
import { isAbortError, useAbortableOperation } from "@/lib/useAbortableOperation";

interface UseSessionPostResult<TResponse> {
  data: TResponse | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  /** True once `cancel()` has fired for the fetch currently (or most
   * recently) in flight -- see useAbortableOperation. Distinct from
   * `error`: the user asking to stop mid-processing isn't a failure. */
  cancelled: boolean;
  /** Milliseconds elapsed since this sessionId's fetch started -- see
   * useAbortableOperation. Ticks while `loading` is true. */
  elapsedMs: number;
  /** Aborts the in-flight fetch, setting `cancelled` and stopping
   * `loading`. A no-op if nothing is in flight (e.g. `initialData` was
   * used and no fetch ever ran). */
  cancel: () => void;
}

/**
 * POSTs `{session_id: sessionId}` to `path` once per sessionId (e.g. on
 * first load or after a page refresh) and returns the parsed response.
 * Shared by useAnalysis and useDedupReport, which previously carried an
 * identical copy of this fetch/loading/error/sessionExpired shape,
 * differing only in URL and response type.
 *
 * Deliberately has no "already started" ref beyond the `ignore` flag
 * below -- under React's Strict Mode double-invoke in development, that
 * flag alone still resolves to exactly one applied result (the second
 * run's), just at the cost of an extra harmless request; a persistent
 * ref that skips the second run's fetch entirely causes the *first*
 * run's own cleanup to mark its in-flight response ignored, with no
 * second fetch left to supply a real one -- loading would then never
 * resolve. If this component is ever reused across a genuine sessionId
 * change without remounting, the new sessionId still gets its own
 * request and a stale in-flight response from the old one is dropped,
 * via this same flag.
 */
export function useSessionPost<TResponse>(
  sessionId: string,
  path: string,
  // Optional escape hatch for a caller that already has the response --
  // e.g. useDedupReport, when the endpoint that created this session
  // already returned the same data a moment earlier (see
  // lib/dedupReportCache.ts). Omitted entirely by every other caller
  // (useAnalysis), which keeps their behavior exactly as it was: the
  // fetch always runs when this parameter is never passed.
  initialData?: TResponse
): UseSessionPostResult<TResponse> {
  const [data, setData] =
    useState<TResponse | null>(initialData ?? null);

  const [loading, setLoading] =
    useState(initialData === undefined);

  const [error, setError] =
    useState<string | null>(null);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  const {
    elapsedMs,
    cancelled,
    start,
    finish,
    cancel,
  } = useAbortableOperation();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Already have the answer -- skip the round trip entirely rather
    // than re-fetching data the caller handed in a moment ago.
    if (initialData !== undefined) {
      return;
    }

    let ignore = false;
    const controller = start();

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setSessionExpired(false);
        // Reset any previously-fetched data from an earlier sessionId/path
        // so a new fetch doesn't briefly render stale data alongside (or
        // instead of) this attempt's own outcome -- currently masked
        // everywhere by the app's `key={sessionId}` remount convention,
        // but not defended in the hook itself.
        setData(null);

        const response = await fetch(
          `${API_URL}${path}`,
          {
            method: "POST",
            // Sends the auth session cookie once auth actually issues
            // one -- inert today (no cookie exists yet), but the seam
            // needs to exist now so wiring auth in later doesn't mean
            // grep-and-patch every fetch call site in the app.
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
            signal: controller.signal,
          }
        );

        if (ignore) return;

        // 401 (not authenticated) is folded into the same
        // "sessionExpired" path as 404 (session gone) for this hook's
        // own local UI purposes -- both mean "nothing to show, start
        // over" here. Only a real 401 means the *auth* session itself
        // is gone, so only that one calls notifyUnauthorized() -- a 404
        // just means this one tool session expired.
        if (
          response.status === 404 ||
          response.status === 401
        ) {
          if (response.status === 401) notifyUnauthorized();
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(response)
          );
        }

        const body: TResponse =
          await response.json();

        if (!ignore) setData(body);
      } catch (err) {
        if (ignore) return;

        // A cleanup-triggered abort (sessionId changed, or this
        // component unmounted) also lands here -- but `ignore` is
        // already true by the time that happens (see the cleanup
        // below), so it's already filtered out above. What reaches
        // here is only a real user cancel() call, which isn't an error.
        if (isAbortError(err)) return;

        setError(
          describeFetchError(err)
        );
      } finally {
        if (!ignore) setLoading(false);
        finish();
      }
    };

    run();

    return () => {
      ignore = true;
      // Not routed through cancel() -- this is React's own cleanup (a
      // sessionId change or unmount), not the user asking to stop, so
      // it must not flip `cancelled` and show a "cancelled" UI state.
      controller.abort();
    };
  }, [sessionId, path, initialData, start, finish]);

  return {
    data,
    loading,
    error,
    sessionExpired,
    cancelled,
    elapsedMs,
    cancel,
  };
}
