"use client";

import { useRef, useState } from "react";

import { useSessionAction } from "@/lib/useSessionAction";
import type { ConfirmedSubstitution } from "@/types/api";

interface UseTaggerSaveToDropboxResult {
  saving: boolean;
  savedPath: string | null;
  error: string | null;
  sessionExpired: boolean;
  handleSave: (
    confirmed: ConfirmedSubstitution[],
    preserveUnderscores: boolean,
    folderPath: string
  ) => Promise<void>;
}

/**
 * Inserts a local timestamp before the extension -- same reasoning as
 * `useDedupSaveToDropbox`'s `withTimestamp`: `DropboxClient::upload` is
 * overwrite-only, so saving the same session twice to the same folder
 * would otherwise silently replace the first file with no warning.
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

const FALLBACK_FILENAME = "tagged.docx";

/**
 * Owns the /tagger/apply-dropbox request -- the Dropbox-destination
 * counterpart to useTaggerApply's browser-download flow. Mirrors
 * useDedupSaveToDropbox exactly, just with tagger's own
 * {confirmed, preserve_blanks} request shape instead of {format}.
 */
export function useTaggerSaveToDropbox(
  sessionId: string
): UseTaggerSaveToDropboxResult {
  const { pending, error, sessionExpired, run } = useSessionAction(
    sessionId,
    "/tagger/apply-dropbox"
  );

  const [savedPath, setSavedPath] = useState<string | null>(null);

  // Same rapid-double-click guard useTaggerApply's applyInFlight uses.
  const saveInFlight = useRef(false);

  const handleSave = async (
    confirmed: ConfirmedSubstitution[],
    preserveUnderscores: boolean,
    folderPath: string
  ) => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;

    setSavedPath(null);

    try {
      const fileName = withTimestamp(FALLBACK_FILENAME);
      const dropboxPath = `${folderPath}/${fileName}`;

      const result = await run({
        confirmed,
        preserve_blanks: preserveUnderscores,
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
