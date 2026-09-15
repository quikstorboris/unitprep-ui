"use client";

import { useRef, useState } from "react";

import { useSessionAction } from "@/lib/useSessionAction";
import type { DedupExportFormat } from "@/types/api";

/** Mirrors the backend's `/dedup/export-dropbox` response -- `path` is the
 * real final Dropbox path (folder + the backend's own computed filename,
 * `{ABBREV}_v{N}_pull_check_{MM-DD-YYYY}.{ext}`), not a client-assembled
 * one. */
interface DedupExportDropboxResponse {
  path: string;
}

interface UseDedupSaveToDropboxResult {
  saving: boolean;
  savedPath: string | null;
  error: string | null;
  sessionExpired: boolean;
  handleSave: (
    format: DedupExportFormat,
    folderPath: string,
    facilityId: string | undefined
  ) => Promise<void>;
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
  sessionId: string,
  /** The client this check was run for, when opened from a client's own
   * Dedup tab -- recorded on the Activity Log entry `/dedup/export-dropbox`
   * writes on success. `undefined` for a standalone run. Mirrors
   * useDedupExport's own `clientId` constructor param. */
  clientId?: string
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
    folderPath: string,
    facilityId: string | undefined
  ) => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;

    setSavedPath(null);

    try {
      // The backend now owns filename generation -- it computes the real,
      // facility-scoped filename (`{ABBREV}_v{N}_pull_check_{MM-DD-YYYY}.{ext}`)
      // from `facility_id` and appends it to `folder_path` itself, returning
      // the final path it actually used in the response below.
      const result = await run({
        format,
        folder_path: folderPath,
        facility_id: facilityId ?? null,
        client_id: clientId,
      });

      if (result.kind !== "ok") return;

      const data: DedupExportDropboxResponse =
        await result.response.json();

      setSavedPath(data.path);
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
