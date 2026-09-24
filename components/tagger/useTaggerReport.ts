"use client";

import { useState } from "react";

import { takeTaggerCheck } from "@/lib/taggerReportCache";
import { useSessionPost } from "@/lib/useSessionPost";
import type { TaggerCheckResponse } from "@/types/api";

interface UseTaggerReportResult {
  candidates: TaggerCheckResponse["candidates"] | null;
  loading: boolean;
  error: string | null;
  sessionExpired: boolean;
  /** True once `cancel()` has fired for this fetch -- see
   * useAbortableOperation. Always false when `candidates` came from the
   * stashed cache instead of a real fetch. */
  cancelled: boolean;
  /** Milliseconds elapsed since this report's fetch started. */
  elapsedMs: number;
  /** Aborts the in-flight report fetch. A no-op once it's settled, or
   * if the response came from the stashed cache and never fetched at all. */
  cancel: () => void;
}

/**
 * Runs POST /tagger/report per sessionId -- unless TaggerUploadPage
 * already stashed this exact session's response (it gets the full
 * candidate list back from POST /tagger/check, a moment before
 * navigating here), in which case this uses that instead and skips the
 * network round trip entirely. Mirrors useDedupReport exactly.
 */
export function useTaggerReport(
  sessionId: string
): UseTaggerReportResult {
  // Read once, at mount, not on every render -- see useDedupReport's own
  // comment for why (this component remounts per sessionId via the
  // route's key={sessionId}, so "once per mount" already means "once
  // per sessionId").
  const [cached] = useState(() =>
    takeTaggerCheck(sessionId)
  );

  const { data, loading, error, sessionExpired, cancelled, elapsedMs, cancel } =
    useSessionPost<TaggerCheckResponse>(
      sessionId,
      "/tagger/report",
      cached
    );

  return {
    candidates: data?.candidates ?? null,
    loading,
    error,
    sessionExpired,
    cancelled,
    elapsedMs,
    cancel,
  };
}
