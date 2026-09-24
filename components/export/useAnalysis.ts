"use client";

import { useSessionPost } from "@/lib/useSessionPost";
import type { AnalyzeResponse } from "@/types/api";

interface UseAnalysisResult {
  analysis: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  /** True once `cancel()` has fired for this fetch -- see
   * useAbortableOperation. */
  cancelled: boolean;
  /** Milliseconds elapsed since this analysis's fetch started. */
  elapsedMs: number;
  /** Aborts the in-flight analysis fetch. A no-op once it's settled. */
  cancel: () => void;
}

/** Runs POST /analyze per sessionId. See useSessionPost for the shared fetch/loading/error/sessionExpired behavior. */
export function useAnalysis(
  sessionId: string
): UseAnalysisResult {
  const { data, loading, error, sessionExpired, cancelled, elapsedMs, cancel } =
    useSessionPost<AnalyzeResponse>(
      sessionId,
      "/analyze"
    );

  return {
    analysis: data,
    loading,
    error,
    sessionExpired,
    cancelled,
    elapsedMs,
    cancel,
  };
}
