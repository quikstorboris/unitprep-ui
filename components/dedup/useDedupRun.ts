"use client";

import { useState } from "react";

import { checkedFilesOf } from "@/components/dedup/dedupChecklist";
import type { DedupSource } from "@/components/dedup/useDedupFolderScan";
import { stashDedupReport } from "@/lib/dedupReportCache";
import { useFileUploadAction } from "@/lib/useFileUploadAction";
import { type SessionActionResult, useJsonPostAction } from "@/lib/useSessionAction";
import type { DedupCheckResponse, DedupClassifyResponse } from "@/types/api";

interface UseDedupRunArgs {
  facilityId: string;
  source: DedupSource | null;
  localFiles: File[];
  classification: DedupClassifyResponse | null;
  checked: ReadonlySet<string>;
  onChecked: (sessionId: string) => void;
}

export interface UseDedupRunResult {
  isChecking: boolean;
  elapsedMs: number;
  cancelled: boolean;
  /** Fraction of the local upload sent so far; `null` for Dropbox imports. */
  uploadProgress: number | null;
  error: string | null;
  run: () => Promise<void>;
  /** Clears a previous run's error (e.g. when the user picks a new source). */
  resetError: () => void;
  cancel: () => void;
}

/**
 * Runs the check on the ticked files: a local pick uploads the real file
 * blobs (one `file` multipart part each) to /dedup/check; a Dropbox pick
 * posts the ticked files' paths to /dedup/import-dropbox. Either way a
 * success hands the new session to `onChecked`.
 */
export function useDedupRun({
  facilityId,
  source,
  localFiles,
  classification,
  checked,
  onChecked,
}: UseDedupRunArgs): UseDedupRunResult {
  const [error, setError] = useState<string | null>(null);

  const upload = useFileUploadAction(`/dedup/check?facility_id=${facilityId}`);
  const importer = useJsonPostAction("/dedup/import-dropbox");

  const handleResult = async (result: SessionActionResult) => {
    if (result.kind === "sessionExpired") {
      setError("Your session has expired — please try again.");
    } else if (result.kind === "error") {
      setError(result.message);
    } else if (result.kind === "ok") {
      // Cancelled falls through: not an error, nothing more to do.
      const data: DedupCheckResponse = await result.response.json();
      // The results page (a moment away, via onChecked's navigation)
      // would otherwise re-fetch this exact report over POST
      // /dedup/report -- stash it so useDedupReport can use it directly.
      stashDedupReport(data.session_id, data.report);
      onChecked(data.session_id);
    }
  };

  const run = async () => {
    const ticked = checkedFilesOf(classification?.files ?? [], checked);

    if (ticked.length === 0) {
      setError("Please tick at least one file before continuing.");
      return;
    }

    setError(null);

    if (source === "dropbox") {
      const paths = ticked.flatMap((f) => (f.path ? [f.path] : []));
      await handleResult(await importer.run({ paths, facility_id: facilityId }));
      return;
    }

    const formData = new FormData();
    for (const file of localFiles) {
      if (checked.has(file.name)) formData.append("file", file, file.name);
    }

    await handleResult(await upload.run(formData));
  };

  const dropbox = source === "dropbox";

  return {
    isChecking: upload.pending || importer.pending,
    elapsedMs: dropbox ? importer.elapsedMs : upload.elapsedMs,
    cancelled: dropbox ? importer.cancelled : upload.cancelled,
    uploadProgress: dropbox ? null : upload.uploadProgress,
    error,
    run,
    resetError: () => setError(null),
    cancel: dropbox ? importer.cancel : upload.cancel,
  };
}
