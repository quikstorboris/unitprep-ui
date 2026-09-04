"use client";

import { useSessionPost } from "@/lib/useSessionPost";

interface TaggerSaveLocationResponse {
  default_folder_path: string | null;
}

interface UseTaggerSaveLocationResult {
  /** `undefined` while loading or on error, `null` for a locally-uploaded
   * session (nothing to default to), or the real `Tagged Templates`
   * subfolder path once resolved -- mirrors `useDedupSaveLocation`. */
  defaultFolderPath: string | null | undefined;
}

/**
 * Runs POST /tagger/save-location once per sessionId -- the Save to
 * Dropbox action's own `initialPath`/one-click-default seed. Mirrors
 * `useDedupSaveLocation` exactly.
 */
export function useTaggerSaveLocation(
  sessionId: string
): UseTaggerSaveLocationResult {
  const { data } = useSessionPost<TaggerSaveLocationResponse>(
    sessionId,
    "/tagger/save-location"
  );

  return {
    defaultFolderPath: data?.default_folder_path,
  };
}
