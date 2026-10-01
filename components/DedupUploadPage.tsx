"use client";

import { useState } from "react";

import { checkedFilesOf, checkedFormatNames, runGate } from "@/components/dedup/dedupChecklist";
import { DedupFileChecklist } from "@/components/dedup/DedupFileChecklist";
import { DedupRequirementsPanel } from "@/components/dedup/DedupRequirementsPanel";
import { DedupSourcePicker } from "@/components/dedup/DedupSourcePicker";
import { useDedupFileRequirements } from "@/components/dedup/useDedupFileRequirements";
import { useDedupFolderScan } from "@/components/dedup/useDedupFolderScan";
import { useDedupRun } from "@/components/dedup/useDedupRun";
import { formatElapsed } from "@/lib/useAbortableOperation";

interface DedupUploadPageProps {
  clientId: string;
  facilityId: string;
  onChecked: (sessionId: string) => void;
}

/**
 * Duplicate Tenant Check entry: pick a folder (or files), review the
 * classified checklist, confirm, run. Thin orchestrator -- picking and
 * classifying lives in useDedupFolderScan, running in useDedupRun.
 */
export default function DedupUploadPage({
  clientId,
  facilityId,
  onChecked,
}: DedupUploadPageProps) {
  const scan = useDedupFolderScan();
  const requirements = useDedupFileRequirements();
  const { classification, checked } = scan;

  const runner = useDedupRun({
    facilityId,
    source: scan.source,
    localFiles: scan.localFiles,
    classification,
    checked,
    onChecked,
  });

  const files = classification?.files ?? [];
  const gate = runGate(files, checked);
  const formatNames = checkedFormatNames(files, checked);
  const confirmKey = checkedFilesOf(files, checked)
    .map((f) => `${f.file_name}:${f.format_name}`)
    .join("|");

  // Confirmation is tied to the exact ticked set it was given for: any
  // change to which files are ticked (or a new scan) withdraws it. This
  // gate is a UX checkpoint -- the backend re-classifies when it runs.
  const [confirmedKey, setConfirmedKey] = useState<string | null>(null);
  const confirmed = confirmedKey !== null && confirmedKey === confirmKey;

  const canRunCheck = !runner.isChecking && !scan.scanning && gate.canRun && confirmed;
  const apiError = scan.error ?? runner.error;

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold">Duplicate Tenant Check</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Select Export Files</h2>

          <div className="rounded border border-slate-700 p-6">
            <DedupSourcePicker
              clientId={clientId}
              facilityId={facilityId}
              source={scan.source}
              localFileCount={scan.localFiles.length}
              dropboxFolder={scan.dropboxFolder}
              disabled={runner.isChecking}
              onLocalPick={(list) => {
                runner.resetError();
                scan.scanLocal(list);
              }}
              onDropboxFolderPick={(path) => {
                runner.resetError();
                scan.scanDropboxFolder(path);
              }}
            />

            {scan.scanning && (
              <div className="mt-4 text-sm text-slate-400">Checking file formats...</div>
            )}

            {classification && !scan.scanning && (
              <>
                <DedupFileChecklist
                  classification={classification}
                  checked={checked}
                  disabled={runner.isChecking}
                  onToggle={scan.toggle}
                  onSelectAll={scan.selectAll}
                  onSelectNone={scan.selectNone}
                />

                {gate.blocked.length > 0 ? (
                  <div className="mt-4 text-sm text-amber-400">
                    Run Check is disabled:{" "}
                    {gate.blocked.map((b) => `"${b.file.file_name}" ${b.reason}`).join("; ")}.
                    Untick {gate.blocked.length === 1 ? "it" : "them"} to continue.
                  </div>
                ) : checked.size === 0 ? (
                  <div className="mt-4 text-sm text-amber-400">
                    Tick at least one file to run the check.
                  </div>
                ) : (
                  <label className="mt-4 flex items-start gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmedKey(e.target.checked ? confirmKey : null)}
                      className="mt-1"
                    />
                    These files are correct: {formatNames.join(", ")}
                  </label>
                )}
              </>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void runner.run()}
                disabled={!canRunCheck}
                className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
              >
                {runner.isChecking
                  ? scan.source === "dropbox"
                    ? "Importing & Checking..."
                    : "Uploading & Checking..."
                  : "Run Check"}
              </button>

              {runner.isChecking && (
                <>
                  {/* An honest elapsed-time counter, not a fake progress bar --
                      neither endpoint streams a real percentage back. The one
                      exception is the local upload's own outgoing bytes, which
                      the browser *can* report truthfully (see
                      useFileUploadAction) -- shown alongside elapsed time, not
                      in place of it, since it only covers the upload leg. */}
                  <span className="text-sm text-slate-400">
                    {runner.uploadProgress !== null &&
                      runner.uploadProgress < 1 &&
                      `${Math.round(runner.uploadProgress * 100)}% uploaded — `}
                    {formatElapsed(runner.elapsedMs)} elapsed
                  </span>

                  <button
                    type="button"
                    onClick={runner.cancel}
                    className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

            {runner.cancelled && !runner.isChecking && (
              <div className="mt-3 text-sm text-amber-400">Check cancelled.</div>
            )}
          </div>

          {apiError && <div className="mt-4 rounded bg-red-900 p-3 text-red-200">{apiError}</div>}
        </div>

        <DedupRequirementsPanel
          requirements={requirements.requirements}
          loading={requirements.loading}
          error={requirements.error}
          detectedPms={classification?.suggested.pms ?? null}
        />
      </div>
    </div>
  );
}
