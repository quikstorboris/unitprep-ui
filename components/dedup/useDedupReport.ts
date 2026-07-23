"use client";

import { useEffect, useState } from "react";

import { API_URL, errorMessageFrom } from "@/lib/api";
import type { DedupReportView } from "@/types/api";

interface UseDedupReportResult {
  report: DedupReportView | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

/**
 * Runs POST /dedup/report per sessionId (e.g. on first load or after a
 * page refresh). Deliberately has no "already started" ref beyond the
 * `ignore` flag below -- under React's Strict Mode double-invoke in
 * development, that flag alone still resolves to exactly one applied
 * result (the second run's), just at the cost of an extra harmless
 * request; a persistent ref that skips the second run's fetch entirely
 * causes the *first* run's own cleanup to mark its in-flight response
 * ignored, with no second fetch left to supply a real one -- loading
 * would then never resolve. If this component is ever reused across a
 * genuine sessionId change without remounting, the new sessionId still
 * gets its own request and a stale in-flight response from the old one
 * is dropped, via this same flag.
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

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let ignore = false;

    const runReportFetch = async () => {
      try {
        setLoading(true);
        setError(null);
        setSessionExpired(false);

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
