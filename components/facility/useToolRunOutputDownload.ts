"use client";

import { describeFetchError } from "@/lib/api";
import { fetchForDownload } from "@/lib/auth-shared";
import { toolRunOutputUrl, toolRunSourceUrl } from "@/lib/clientsDetail";
import { downloadBlob } from "@/lib/useSessionAction";

export type ToolRunOutputDownloadResult =
  | { kind: "ok" }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

/**
 * Shared GET-blob-download plumbing for a run's stored output/source
 * files. A plain authenticated GET, not `useSessionAction`/
 * `useFileUploadAction` -- both of those are scoped to an in-flight
 * tool session, not durable facility history. Same credentials/blob/
 * `downloadBlob` pattern `useDedupExport`'s own `handleExport` already
 * uses for the live export download.
 */
async function downloadFromPath(path: string, fallbackFileName: string): Promise<ToolRunOutputDownloadResult> {
  const fetched = await fetchForDownload(path, undefined, "GET");
  if (fetched.kind !== "ok") {
    return fetched;
  }

  try {
    const blob = await fetched.response.blob();
    downloadBlob(blob, fetched.response.headers.get("Content-Disposition"), fallbackFileName);
    return { kind: "ok" };
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

export async function downloadToolRunOutput(
  companyId: string,
  facilityId: string,
  runId: string,
  fallbackFileName: string
): Promise<ToolRunOutputDownloadResult> {
  return downloadFromPath(toolRunOutputUrl(companyId, facilityId, runId), fallbackFileName);
}

/** Downloads a run's original source file straight from the DB --
 * always available regardless of what may have since happened to
 * `source_dropbox_path` in Dropbox itself (see `has_source_file` on
 * `ToolRunSummary`). */
export async function downloadToolRunSource(
  companyId: string,
  facilityId: string,
  runId: string,
  fallbackFileName: string
): Promise<ToolRunOutputDownloadResult> {
  return downloadFromPath(toolRunSourceUrl(companyId, facilityId, runId), fallbackFileName);
}
