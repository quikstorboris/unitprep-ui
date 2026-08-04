"use client";

import { useState } from "react";

import { takeDedupReport } from "@/lib/dedupReportCache";
import { useSessionPost } from "@/lib/useSessionPost";
import type { DedupReportView } from "@/types/api";

interface UseDedupReportResult {
  report: DedupReportView | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
}

/**
 * Runs POST /dedup/report per sessionId -- unless DedupUploadPage already
 * stashed this exact session's report (it gets the full report back from
 * POST /dedup/check, a moment before navigating here), in which case this
 * uses that instead and skips the network round trip entirely. A direct
 * visit or refresh of this URL (nothing stashed) falls back to the
 * ordinary fetch exactly as before. See useSessionPost for the shared
 * fetch/loading/error/sessionExpired behavior.
 */
export function useDedupReport(
  sessionId: string
): UseDedupReportResult {
  // Read once, at mount, not on every render -- this component remounts
  // on a new sessionId via the route's own key={sessionId} (see
  // DedupResultsRoute), so "once per mount" already means "once per
  // sessionId". Reading takeDedupReport unconditionally on every render
  // would both drain the single-use cache slot prematurely and hand
  // useSessionPost a different value on each call.
  const [cached] = useState(() => takeDedupReport(sessionId));

  const { data, loading, error, sessionExpired } =
    useSessionPost<DedupReportView>(
      sessionId,
      "/dedup/report",
      cached
    );

  return {
    report: data,
    loading,
    error,
    sessionExpired,
  };
}
