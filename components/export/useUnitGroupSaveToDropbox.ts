"use client";

import { useRef, useState } from "react";

import { useSessionAction } from "@/lib/useSessionAction";

interface UseUnitGroupSaveToDropboxResult {
  saving: boolean;
  savedPath: string | null;
  error: string | null;
  sessionExpired: boolean;
  handleSave: (folderPath: string) => Promise<void>;
}

/**
 * Inserts a local timestamp before the extension -- same reasoning as
 * `useDedupSaveToDropbox`'s `withTimestamp`: `DropboxClient::upload` is
 * overwrite-only, so saving the same session twice to the same folder
 * would otherwise silently replace the first export with no warning.
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

const FALLBACK_FILENAME = "UnitPrep_Output.zip";

/**
 * Owns the /export/export-dropbox request -- the Dropbox-destination
 * counterpart to useExportDownload's browser-download flow. Mirrors
 * useDedupSaveToDropbox, minus the format parameter (Unit Groups always
 * produces the one ZIP).
 */
export function useUnitGroupSaveToDropbox(
  sessionId: string,
  /** Same reasoning as useExportDownload's own clientId -- recorded on
   * the Activity Log entry `/export/export-dropbox` writes on success. */
  clientId?: string
): UseUnitGroupSaveToDropboxResult {
  const { pending, error, sessionExpired, run } = useSessionAction(
    sessionId,
    "/export/export-dropbox"
  );

  const [savedPath, setSavedPath] = useState<string | null>(null);

  // Same rapid-double-click guard useExportDownload's exportInFlight uses.
  const saveInFlight = useRef(false);

  const handleSave = async (folderPath: string) => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;

    setSavedPath(null);

    try {
      const fileName = withTimestamp(FALLBACK_FILENAME);
      const dropboxPath = `${folderPath}/${fileName}`;

      const result = await run({
        client_id: clientId,
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
