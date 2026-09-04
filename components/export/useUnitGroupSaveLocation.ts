"use client";

import { useSessionPost } from "@/lib/useSessionPost";

interface ExportSaveLocationResponse {
  default_folder_path: string | null;
}

interface UseUnitGroupSaveLocationResult {
  /** `undefined` while loading or on error, `null` for a locally-uploaded
   * session (nothing to default to), or the real `Group Prep Output`
   * subfolder path once resolved -- mirrors `useDedupSaveLocation`. */
  defaultFolderPath: string | null | undefined;
}

/**
 * Runs POST /export/save-location once per sessionId -- the Save to
 * Dropbox action's own one-click default seed. Mirrors
 * `useDedupSaveLocation` exactly.
 */
export function useUnitGroupSaveLocation(
  sessionId: string
): UseUnitGroupSaveLocationResult {
  const { data } = useSessionPost<ExportSaveLocationResponse>(
    sessionId,
    "/export/save-location"
  );

  return {
    defaultFolderPath: data?.default_folder_path,
  };
}
