"use client";

import { useSessionPost } from "@/lib/useSessionPost";
import type { DedupReportView } from "@/types/api";

interface UseDedupReportResult {
  report: DedupReportView | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

/** Runs POST /dedup/report per sessionId. See useSessionPost for the shared fetch/loading/error/sessionExpired behavior. */
export function useDedupReport(
  sessionId: string
): UseDedupReportResult {
  const { data, loading, error, sessionExpired } =
    useSessionPost<DedupReportView>(
      sessionId,
      "/dedup/report"
    );

  return {
    report: data,
    loading,
    error,
    sessionExpired,
  };
}
