"use client";

import { DropboxLogo } from "./icons/DropboxLogo";
import AdvisoryIssuesTable from "./export/AdvisoryIssuesTable";
import NetNewGroupsTable from "./export/NetNewGroupsTable";
import SimilarGroupsTable from "./export/SimilarGroupsTable";
import SummaryStats from "./export/SummaryStats";
import { useAnalysis } from "./export/useAnalysis";
import { useExportDownload } from "./export/useExportDownload";
import { useUnitGroupSaveLocation } from "./export/useUnitGroupSaveLocation";
import { useUnitGroupSaveToDropbox } from "./export/useUnitGroupSaveToDropbox";
import SessionExpiredPage from "./SessionExpiredPage";
import { dropboxFolderWebUrl, dropboxParentFolder } from "@/lib/dropbox";

interface ExportCompletePageProps {
  sessionId: string;
  /** The client this run was for, when opened from a client's own Unit
   * Groups tab -- forwarded to `useExportDownload` for the Activity Log
   * entry `/export` writes on success. */
  clientId?: string;
  onBack: () => void;
  onHome: () => void;
}

interface DropboxSaveActionProps {
  defaultFolderPath: string | null | undefined;
  savedPath: string | null;
  saving: boolean;
  onSave: () => void;
  sizeClassName: string;
}

/** One-click "Save to Facility Folder" -> "Open Destination Folder"
 * pair, shared between the pre- and post-download panels below (saving
 * to Dropbox is independent of downloading locally). Mirrors
 * DedupResultsPage's own `DropboxSaveAction` exactly. */
function DropboxSaveAction({
  defaultFolderPath,
  savedPath,
  saving,
  onSave,
  sizeClassName,
}: DropboxSaveActionProps) {
  if (savedPath) {
    return (
      <a
        href={dropboxFolderWebUrl(dropboxParentFolder(savedPath))}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded bg-[#0061FF] text-sm font-medium text-white transition-colors hover:bg-[#0050d1] ${sizeClassName}`}
      >
        <DropboxLogo className="h-4 w-4" />
        Open Destination Folder
      </a>
    );
  }

  if (!defaultFolderPath) return null;

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving}
      className={`inline-flex items-center gap-2 rounded bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 ${sizeClassName}`}
    >
      <DropboxLogo className="h-4 w-4" />
      {saving ? "Saving…" : "Save to Facility Folder"}
    </button>
  );
}

export default function ExportCompletePage({
  sessionId,
  clientId,
  onBack,
  onHome,
}: ExportCompletePageProps) {
  const {
    analysis,
    loading,
    error: analysisError,
    sessionExpired: analysisExpired,
  } = useAnalysis(sessionId);

  const {
    exporting,
    downloadComplete,
    error: exportError,
    sessionExpired: exportExpired,
    handleExport,
  } = useExportDownload(sessionId, clientId);

  const {
    saving,
    savedPath,
    error: saveError,
    sessionExpired: saveExpired,
    handleSave,
  } = useUnitGroupSaveToDropbox(sessionId, clientId);

  const { defaultFolderPath } = useUnitGroupSaveLocation(sessionId);

  if (analysisExpired || exportExpired || saveExpired) {
    return (
      <SessionExpiredPage
        onHome={onHome}
      />
    );
  }

  if (loading) {
    return (
      <div className="text-slate-100">
        Running analysis...
      </div>
    );
  }

  // Only an analysis failure replaces the whole page — there's nothing
  // to show without it. An export failure (below) doesn't get the same
  // treatment: it shouldn't hide analysis results the user already has.
  if (analysisError) {
    return (
      <div className="space-y-4">
        <div className="text-red-400">
          {analysisError}
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="rounded bg-slate-700 px-4 py-2 text-white"
          >
            ← Back
          </button>

          <button
            onClick={onHome}
            className="rounded bg-slate-700 px-4 py-2 text-white"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl text-slate-100">
      <div className="mb-6 flex gap-4">
        <button
          onClick={onBack}
          className="rounded bg-slate-700 px-4 py-2"
        >
          ← Back
        </button>
      </div>

      <h1 className="mb-8 text-4xl font-bold">
        Export Review
      </h1>

      <div className="mb-8 rounded border border-green-800 bg-green-950 p-4">
        Review the findings below before
        generating the export ZIP.
      </div>

      {analysis && (
        <>
          <SummaryStats
            analysis={analysis}
          />

          <div className="mt-8 space-y-6">
            <NetNewGroupsTable
              groups={
                analysis.net_new_group_details
              }
            />

            <SimilarGroupsTable
              matches={
                analysis.similar_group_details
              }
            />

            <AdvisoryIssuesTable
              issues={
                analysis.advisory_issue_details
              }
            />
          </div>
        </>
      )}

      {exportError && (
        <div className="mt-8 rounded bg-red-900 p-3 text-red-200">
          {exportError}
        </div>
      )}

      {saveError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">
          {saveError}
        </div>
      )}

      {!downloadComplete && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded bg-green-600 px-5 py-3 disabled:opacity-50"
          >
            {exporting
              ? "Generating ZIP..."
              : "Download Export ZIP"}
          </button>

          <DropboxSaveAction
            defaultFolderPath={defaultFolderPath}
            savedPath={savedPath}
            saving={saving}
            onSave={() => defaultFolderPath && handleSave(defaultFolderPath)}
            sizeClassName="px-5 py-3"
          />
        </div>
      )}

      {downloadComplete && (
        <div className="mt-8 space-y-4">
          <div className="text-xl text-green-400">
            Export Downloaded Successfully
          </div>

          <div className="text-slate-300">
            Your UnitPrep export ZIP has
            been generated and downloaded
            directly from memory.
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleExport}
              className="rounded bg-blue-600 px-4 py-2"
            >
              Download Again
            </button>

            <DropboxSaveAction
              defaultFolderPath={defaultFolderPath}
              savedPath={savedPath}
              saving={saving}
              onSave={() => defaultFolderPath && handleSave(defaultFolderPath)}
              sizeClassName="px-4 py-2"
            />

            <button
              onClick={onHome}
              className="rounded bg-slate-700 px-4 py-2"
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
