"use client";

import { useSessionPost } from "@/lib/useSessionPost";

interface DedupSaveLocationResponse {
  default_folder_path: string | null;
}

interface UseDedupSaveLocationResult {
  /** `undefined` while loading or on error, `null` for a locally-uploaded
   * session (nothing to default to), or the real `Duplicate Check`
   * subfolder path once resolved -- see the backend's own
   * `DedupSaveLocationResponse` doc comment. */
  defaultFolderPath: string | null | undefined;
}

/**
 * Runs POST /dedup/save-location once per sessionId -- the Save to
 * Dropbox picker's own `initialPath` seed, mirroring `useDedupReport`'s
 * use of the same shared `useSessionPost` fetch-on-mount plumbing.
 */
export function useDedupSaveLocation(
  sessionId: string
): UseDedupSaveLocationResult {
  const { data } = useSessionPost<DedupSaveLocationResponse>(
    sessionId,
    "/dedup/save-location"
  );

  return {
    defaultFolderPath: data?.default_folder_path,
  };
}
