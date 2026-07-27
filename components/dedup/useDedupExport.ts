"use client";

import { useState } from "react";

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

const FALLBACK_FILENAMES: Record<
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
  sessionId: string
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

  const handleExport = async (
    format: DedupExportFormat
  ) => {
    const result = await run({ format });

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
  };

  return {
    exporting: pending,
    downloadComplete,
    error,
    sessionExpired,
    handleExport,
  };
}
