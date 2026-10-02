"use client";

import { useState } from "react";

import { DropboxLogo } from "@/components/icons/DropboxLogo";
import { fallbackOutputName } from "@/components/facility/toolRunLabels";
import {
  downloadToolRunOutput,
  downloadToolRunSource,
} from "@/components/facility/useToolRunOutputDownload";
import { hasPermission } from "@/lib/auth-session";
import { deleteToolRun } from "@/lib/clientsDetail";
import { useCurrentUser } from "@/lib/currentUser";
import { dropboxFolderWebUrl, dropboxParentFolder } from "@/lib/dropbox";
import type { ToolRunSummary } from "@/types/api";

interface RunActionProps {
  companyId: string;
  facilityId: string;
  run: ToolRunSummary;
}

export function RunOutputAction({
  companyId,
  facilityId,
  run,
}: RunActionProps) {
  const { user } = useCurrentUser();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (run.output_kind === "none") return null;

  // "dropbox" and "both" mean the file was saved to Dropbox; "download" and
  // "both" mean OO also keeps a copy. The Dropbox link is governed by
  // Dropbox's own access; the stored copy needs client_ops.perform at the
  // API, so that button is hidden without it.
  const dropboxPath =
    run.output_kind === "dropbox" || run.output_kind === "both"
      ? run.output_dropbox_path
      : null;
  const hasStoredCopy =
    run.output_kind === "download" || run.output_kind === "both";
  const canDownload =
    hasStoredCopy && hasPermission(user, "client_ops.perform");

  if (!dropboxPath && !canDownload) return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    const result = await downloadToolRunOutput(
      companyId,
      facilityId,
      run.id,
      fallbackOutputName(run.tool),
    );

    setDownloading(false);
    if (result.kind !== "ok") setError(result.message);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {dropboxPath && (
          <a
            href={dropboxFolderWebUrl(dropboxParentFolder(dropboxPath))}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded bg-[#0061FF] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#0050d1]"
          >
            <DropboxLogo className="h-3.5 w-3.5" />
            Open in Dropbox
          </a>
        )}
        {canDownload && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="w-fit rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? "Downloading…" : "Download Output"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function RunSourceAction({
  companyId,
  facilityId,
  run,
}: RunActionProps) {
  const { user } = useCurrentUser();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The stored source is the raw upload (it can carry card data and SSNs),
  // so the API limits it to client_ops.perform; hide the button rather
  // than offer one that can only fail. The API is the real gate.
  if (!run.has_source_file || !hasPermission(user, "client_ops.perform"))
    return null;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    const result = await downloadToolRunSource(
      companyId,
      facilityId,
      run.id,
      run.source_file_name,
    );

    setDownloading(false);
    if (result.kind !== "ok") setError(result.message);
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="text-xs font-medium text-blue-400 transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {downloading ? "Downloading…" : "Download Source File"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

/**
 * "Clear a mistaken run" action -- e.g. a Dedup check accidentally run
 * against the wrong facility's data (2026-09-23). Permanent, so it goes
 * through the same click-to-confirm shape `ElavonTab`'s own Unlink
 * button already uses, rather than a single click.
 */
export function DeleteRunButton({
  companyId,
  facilityId,
  run,
  onDeleted,
}: RunActionProps & { onDeleted: (runId: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    const result = await deleteToolRun(companyId, facilityId, run.id);

    setDeleting(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    onDeleted(run.id);
  };

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-400">
            Delete this run permanently?
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
    >
      Delete
    </button>
  );
}
