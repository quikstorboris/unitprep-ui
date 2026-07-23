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
 * or after a page refresh). The ref guard mirrors useAnalysis's own —
 * without it, mounting twice would fire the request twice under React's
 * Strict Mode double-invoke in development.
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

  const started = useRef(false);

  useEffect(() => {
    if (
      !sessionId ||
      started.current
    ) {
      return;
    }

    started.current = true;

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

        setReport(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unknown error"
        );
      } finally {
        setLoading(false);
      }
    };

    runReportFetch();
  }, [sessionId]);

  return {
    report,
    loading,
    error,
    sessionExpired,
  };
}
