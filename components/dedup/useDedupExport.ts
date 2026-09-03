"use client";

import { useRef, useState } from "react";

import { downloadBlob, useSessionAction } from "@/lib/useSessionAction";
import type { DedupExportFormat } from "@/types/api";

interface UseDedupExportResult {
  exporting: boolean;
  downloadComplete: boolean;
  error: string | null;
  sessionExpired: boolean;
  handleExport: (
    format: DedupExportFormat
  ) => Promise<void>;
}

export const FALLBACK_FILENAMES: Record<
  DedupExportFormat,
  string
> = {
  csv: "duplicate_tenant_check.csv",
  xlsx: "duplicate_tenant_check.xlsx",
  both: "duplicate_tenant_check.zip",
};

/**
 * Owns the /dedup/export request and the resulting browser download.
 * Mirrors useExportDownload — kept as its own hook rather than shared,
 * since the two tools' export payloads (CSV vs. ZIP) and fallback
 * filenames differ, even though the request/download plumbing is now
 * the same shared useSessionAction/downloadBlob underneath.
 */
export function useDedupExport(
  sessionId: string,
  /** The client this check was run for, when opened from a client's own
   * Dedup tab -- recorded on the Activity Log entry `/dedup/export`
   * writes on success. `undefined` for a standalone run. */
  clientId?: string
): UseDedupExportResult {
  const { pending, error, sessionExpired, run } =
    useSessionAction(
      sessionId,
      "/dedup/export"
    );

  const [
    downloadComplete,
    setDownloadComplete,
  ] = useState(false);

  // Guards a rapid double-invocation of handleExport (e.g. a second click
  // landing before React commits `pending: true` and the button's own
  // `disabled` prop actually takes effect) from firing two concurrent
  // /dedup/export requests. A ref, not `pending` itself, because `pending`
  // is state -- it isn't updated synchronously within the same tick a
  // second call could arrive in, so checking it here wouldn't reliably
  // catch one. Mirrors useExportDownload.
  const exportInFlight = useRef(false);

  const handleExport = async (
    format: DedupExportFormat
  ) => {
    if (exportInFlight.current) return;
    exportInFlight.current = true;

    // Reset so a second attempt doesn't render the *previous* attempt's
    // success state alongside (or instead of) this attempt's own outcome.
    setDownloadComplete(false);

    try {
      const result = await run({ format, client_id: clientId });

      if (result.kind !== "ok") return;

      const blob =
        await result.response.blob();

      downloadBlob(
        blob,
        result.response.headers.get(
          "Content-Disposition"
        ),
        FALLBACK_FILENAMES[format]
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
