"use client";

import AdvisoryIssuesTable from "./export/AdvisoryIssuesTable";
import NetNewGroupsTable from "./export/NetNewGroupsTable";
import SimilarGroupsTable from "./export/SimilarGroupsTable";
import SummaryStats from "./export/SummaryStats";
import { useAnalysis } from "./export/useAnalysis";
import { useExportDownload } from "./export/useExportDownload";
import SessionExpiredPage from "./SessionExpiredPage";

interface ExportCompletePageProps {
  sessionId: string;
  acknowledgeErrors: boolean;
  onHome: () => void;
}

export default function ExportCompletePage({
  sessionId,
  acknowledgeErrors,
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
  } = useExportDownload(
    sessionId,
    acknowledgeErrors
  );

  if (analysisExpired || exportExpired) {
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

        <button
          onClick={onHome}
          className="rounded bg-slate-700 px-4 py-2 text-white"
        >
          Home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl text-slate-100">
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

      {!downloadComplete && (
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-8 rounded bg-green-600 px-5 py-3 disabled:opacity-50"
        >
          {exporting
            ? "Generating ZIP..."
            : "Download Export ZIP"}
        </button>
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

          <div className="flex gap-4">
            <button
              onClick={handleExport}
              className="rounded bg-blue-600 px-4 py-2"
            >
              Download Again
            </button>

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
