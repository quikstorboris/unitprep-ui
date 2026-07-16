"use client";

import { useState } from "react";

import { API_URL, errorMessageFrom } from "@/lib/api";

interface UseDedupExportResult {
  exporting: boolean;
  downloadComplete: boolean;
  error: string | null;
  sessionExpired: boolean;
  handleExport: () => Promise<void>;
}

const FALLBACK_FILENAME =
  "duplicate_tenant_check.csv";

function filenameFromDisposition(
  disposition: string | null
): string {
  if (!disposition) {
    return FALLBACK_FILENAME;
  }

  const match = disposition.match(
    /filename="([^"]+)"/
  );

  return (
    match?.[1] ?? FALLBACK_FILENAME
  );
}

function triggerBrowserDownload(
  blob: Blob,
  filename: string
): void {
  const url =
    window.URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
}

/**
 * Owns the /dedup/export request and the resulting browser download.
 * Mirrors useExportDownload — kept as its own hook rather than shared,
 * since the two tools' export payloads (CSV vs. ZIP) and session shapes
 * differ, even though the request/download plumbing looks the same.
 */
export function useDedupExport(
  sessionId: string
): UseDedupExportResult {
  const [exporting, setExporting] =
    useState(false);

  const [
    downloadComplete,
    setDownloadComplete,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/dedup/export`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
          }),
        }
      );

      if (response.status === 404) {
        setSessionExpired(true);
        return;
      }

      if (!response.ok) {
        throw new Error(
          await errorMessageFrom(response)
        );
      }

      const blob =
        await response.blob();

      const filename =
        filenameFromDisposition(
          response.headers.get(
            "Content-Disposition"
          )
        );

      triggerBrowserDownload(
        blob,
        filename
      );

      setDownloadComplete(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown error"
      );
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    downloadComplete,
    error,
    sessionExpired,
    handleExport,
  };
}
