"use client";

import { useRef, useState } from "react";

import { useSessionAction } from "@/lib/useSessionAction";
import type { DedupExportFormat } from "@/types/api";
import { FALLBACK_FILENAMES } from "./useDedupExport";

interface UseDedupSaveToDropboxResult {
  saving: boolean;
  savedPath: string | null;
  error: string | null;
  sessionExpired: boolean;
  handleSave: (
    format: DedupExportFormat,
    folderPath: string
  ) => Promise<void>;
}

/**
 * Inserts a local timestamp before the extension, e.g.
 * "duplicate_tenant_check.csv" -> "duplicate_tenant_check_2026-08-28_1423.csv".
 * `DropboxClient::upload` (unitprep-api) is overwrite-only -- without
 * this, saving the same session's export to the same folder twice would
 * silently replace the first file with no warning.
 */
function withTimestamp(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const base = dot === -1 ? fileName : fileName.slice(0, dot);
  const ext = dot === -1 ? "" : fileName.slice(dot);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}_${pad(now.getHours())}${pad(now.getMinutes())}`;

  return `${base}_${stamp}${ext}`;
}

/**
 * Owns the /dedup/export-dropbox request -- the Dropbox-destination
 * counterpart to useDedupExport's browser-download flow. Kept as its own
 * hook for the same reason useDedupExport is: the two actions' success
 * states (a downloaded blob vs. a saved Dropbox path) are different
 * enough that sharing one hook would mean branching internally rather
 * than actually removing duplication.
 */
export function useDedupSaveToDropbox(
  sessionId: string
): UseDedupSaveToDropboxResult {
  const { pending, error, sessionExpired, run } = useSessionAction(
    sessionId,
    "/dedup/export-dropbox"
  );

  const [savedPath, setSavedPath] = useState<string | null>(null);

  // Same rapid-double-click guard useDedupExport's exportInFlight uses --
  // see that hook's comment for why a ref, not `pending` itself.
  const saveInFlight = useRef(false);

  const handleSave = async (
    format: DedupExportFormat,
    folderPath: string
  ) => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;

    setSavedPath(null);

    try {
      const fileName = withTimestamp(FALLBACK_FILENAMES[format]);
      const dropboxPath = `${folderPath}/${fileName}`;

      const result = await run({
        format,
        dropbox_path: dropboxPath,
      });

      if (result.kind !== "ok") return;

      setSavedPath(dropboxPath);
    } finally {
      saveInFlight.current = false;
    }
  };

  return {
    saving: pending,
    savedPath,
    error,
    sessionExpired,
    handleSave,
  };
}
