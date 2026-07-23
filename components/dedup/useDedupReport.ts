"use client";

import { useEffect, useRef, useState } from "react";

import { API_URL, errorMessageFrom } from "@/lib/api";
import type { DedupReportView } from "@/types/api";

interface UseDedupReportResult {
  report: DedupReportView | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

/**
 * Runs POST /dedup/report exactly once per sessionId (e.g. on first load
 * or after a page refresh). `startedFor` (rather than a plain boolean
 * ref) mirrors useAnalysis's own reasoning: it's safe under React's
 * Strict Mode double-invoke in development (same sessionId fires once),
 * and if this component is ever reused across a genuine sessionId change
 * without remounting, the new sessionId still gets its own request
 * instead of being silently skipped. The `ignore` flag stops a slow,
 * stale response from a previous sessionId overwriting state after that
 * change.
 */
export function useDedupReport(
  sessionId: string
): UseDedupReportResult {
  const [report, setReport] =
    useState<DedupReportView | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (
      !sessionId ||
      startedFor.current === sessionId
    ) {
      return;
    }

    startedFor.current = sessionId;
    let ignore = false;

    setLoading(true);
    setError(null);
    setSessionExpired(false);

    const runReportFetch = async () => {
      try {
        const response = await fetch(
          `${API_URL}/dedup/report`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );

        if (ignore) return;

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(response)
          );
        }

        const data: DedupReportView =
          await response.json();

        if (!ignore) setReport(data);
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Unknown error"
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    runReportFetch();

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  return {
    report,
    loading,
    error,
    sessionExpired,
  };
}
