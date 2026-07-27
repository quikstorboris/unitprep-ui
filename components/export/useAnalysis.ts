"use client";

import { useSessionPost } from "@/lib/useSessionPost";
import type { AnalyzeResponse } from "@/types/api";

interface UseAnalysisResult {
  analysis: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

/** Runs POST /analyze per sessionId. See useSessionPost for the shared fetch/loading/error/sessionExpired behavior. */
export function useAnalysis(
  sessionId: string
): UseAnalysisResult {
  const { data, loading, error, sessionExpired } =
    useSessionPost<AnalyzeResponse>(
      sessionId,
      "/analyze"
    );

  return {
    analysis: data,
    loading,
    error,
    sessionExpired,
  };
}
