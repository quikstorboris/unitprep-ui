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

  const { data, loading, error, sessionExpired } =
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
  };
}
