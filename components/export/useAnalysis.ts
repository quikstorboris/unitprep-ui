"use client";

import { useEffect, useRef, useState } from "react";

import { API_URL } from "@/lib/api";
import type { AnalyzeResponse } from "@/types/api";

interface UseAnalysisResult {
  analysis: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

/**
 * Runs POST /analyze exactly once per sessionId. The ref guard (rather
 * than relying on the effect's dependency array alone) is what makes
 * this safe under React's Strict Mode double-invoke in development —
 * without it, mounting twice would fire the request twice.
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

  const started = useRef(false);

  useEffect(() => {
    if (
      !sessionId ||
      started.current
    ) {
      return;
    }

    started.current = true;

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

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data: AnalyzeResponse =
          await response.json();

        setAnalysis(data);
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

    runAnalysis();
  }, [sessionId]);

  return {
    analysis,
    loading,
    error,
    sessionExpired,
  };
}
