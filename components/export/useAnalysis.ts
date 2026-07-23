"use client";

import { useEffect, useRef, useState } from "react";

import { API_URL, errorMessageFrom } from "@/lib/api";
import type { AnalyzeResponse } from "@/types/api";

interface UseAnalysisResult {
  analysis: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

/**
 * Runs POST /analyze exactly once per sessionId. `startedFor` (rather
 * than a plain boolean ref) is what makes this safe both under React's
 * Strict Mode double-invoke in development (mounting twice for the same
 * sessionId fires the request once) and if this component is ever reused
 * across a genuine sessionId change without remounting (a new sessionId
 * always gets its own request instead of being silently skipped). The
 * `ignore` flag stops a slow, stale response from a previous sessionId
 * overwriting state after that change.
 */
export function useAnalysis(
  sessionId: string
): UseAnalysisResult {
  const [analysis, setAnalysis] =
    useState<AnalyzeResponse | null>(
      null
    );

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

    const runAnalysis = async () => {
      try {
        const response = await fetch(
          `${API_URL}/analyze`,
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

        const data: AnalyzeResponse =
          await response.json();

        if (!ignore) setAnalysis(data);
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

    runAnalysis();

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  return {
    analysis,
    loading,
    error,
    sessionExpired,
  };
}
