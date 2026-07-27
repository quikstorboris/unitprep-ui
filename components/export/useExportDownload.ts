"use client";

import { useState } from "react";

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
  sessionId: string,
  acknowledgeErrors: boolean = false
): UseExportDownloadResult {
  const { pending, error, sessionExpired, run } =
    useSessionAction(sessionId, "/export");

  const [
    downloadComplete,
    setDownloadComplete,
  ] = useState(false);

  const handleExport = async () => {
    const result = await run({
      acknowledge_errors:
        acknowledgeErrors,
    });

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
  };

  return {
    exporting: pending,
    downloadComplete,
    error,
    sessionExpired,
    handleExport,
  };
}
