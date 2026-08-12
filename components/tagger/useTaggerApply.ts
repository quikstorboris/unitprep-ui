"use client";

import { useRef, useState } from "react";

import { downloadBlob, useSessionAction } from "@/lib/useSessionAction";
import type { ConfirmedSubstitution } from "@/types/api";

interface UseTaggerApplyResult {
  applying: boolean;
  downloadComplete: boolean;
  error: string | null;
  sessionExpired: boolean;
  handleApply: (
    confirmed: ConfirmedSubstitution[],
    preserveBlanks: boolean
  ) => Promise<void>;
}

const FALLBACK_FILENAME = "tagged.docx";

/**
 * Owns the /tagger/apply request and the resulting browser download.
 * Mirrors useDedupExport exactly -- same request/download plumbing
 * (useSessionAction + downloadBlob), just a different endpoint and
 * request shape ({session_id, confirmed} instead of {session_id, format}).
 */
export function useTaggerApply(
  sessionId: string
): UseTaggerApplyResult {
  const { pending, error, sessionExpired, run } = useSessionAction(
    sessionId,
    "/tagger/apply"
  );

  const [downloadComplete, setDownloadComplete] = useState(false);

  // Guards a rapid double-invocation of handleApply -- same reasoning as
  // useDedupExport's exportInFlight.
  const applyInFlight = useRef(false);

  const handleApply = async (
    confirmed: ConfirmedSubstitution[],
    preserveBlanks: boolean
  ) => {
    if (applyInFlight.current) return;
    applyInFlight.current = true;

    // Reset so a second attempt doesn't render the *previous* attempt's
    // success state alongside (or instead of) this attempt's own outcome.
    setDownloadComplete(false);

    try {
      const result = await run({
        confirmed,
        preserve_blanks: preserveBlanks,
      });

      if (result.kind !== "ok") return;

      const blob = await result.response.blob();

      downloadBlob(
        blob,
        result.response.headers.get("Content-Disposition"),
        FALLBACK_FILENAME
      );

      setDownloadComplete(true);
    } finally {
      applyInFlight.current = false;
    }
  };

  return {
    applying: pending,
    downloadComplete,
    error,
    sessionExpired,
    handleApply,
  };
}
