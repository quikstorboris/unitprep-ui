"use client";

import { useRef, useState } from "react";

import { downloadBlob, useSessionAction } from "@/lib/useSessionAction";

interface UseExportDownloadResult {
  exporting: boolean;
  downloadComplete: boolean;
  error: string | null;
  sessionExpired: boolean;
  handleExport: () => Promise<void>;
}

const FALLBACK_FILENAME =
  "UnitPrep_Output.zip";

/**
 * Owns the /export request and the resulting browser download. Kept
 * separate from useAnalysis so an export-time error doesn't have to
 * share state with (and potentially hide) the already-rendered analysis
 * results — see ExportCompletePage for how the two errors are displayed
 * differently.
 */
export function useExportDownload(
  sessionId: string
): UseExportDownloadResult {
  const { pending, error, sessionExpired, run } =
    useSessionAction(sessionId, "/export");

  const [
    downloadComplete,
    setDownloadComplete,
  ] = useState(false);

  // Guards a rapid double-invocation of handleExport (e.g. a second click
  // landing before React commits `pending: true` and the button's own
  // `disabled` prop actually takes effect) from firing two concurrent
  // /export requests. A ref, not `pending` itself, because `pending` is
  // state -- it isn't updated synchronously within the same tick a second
  // call could arrive in, so checking it here wouldn't reliably catch one.
  const exportInFlight = useRef(false);

  const handleExport = async () => {
    if (exportInFlight.current) return;
    exportInFlight.current = true;

    // Reset so a second attempt doesn't render the *previous* attempt's
    // success state alongside (or instead of) this attempt's own outcome.
    setDownloadComplete(false);

    try {
      const result = await run();

      if (result.kind !== "ok") return;

      const blob =
        await result.response.blob();

      downloadBlob(
        blob,
        result.response.headers.get(
          "Content-Disposition"
        ),
        FALLBACK_FILENAME
      );

      setDownloadComplete(true);
    } finally {
      exportInFlight.current = false;
    }
  };

  return {
    exporting: pending,
    downloadComplete,
    error,
    sessionExpired,
    handleExport,
  };
}
