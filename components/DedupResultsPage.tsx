"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import ClickUpRunUpdatePanel from "./clickup/ClickUpRunUpdatePanel";
import { useClickUpAccess } from "./clickup/useClickUpAccess";
import DedupSummaryStats from "./dedup/DedupSummaryStats";
import FlaggedGroupsSection from "./dedup/FlaggedGroupsSection";
import RelatedTenantsSection from "./dedup/RelatedTenantsSection";
import TypoVariantsSection from "./dedup/TypoVariantsSection";
import DuplicateCustomerRecordsSection from "./dedup/DuplicateCustomerRecordsSection";
import UnidentifiedTenantsSection from "./dedup/UnidentifiedTenantsSection";
import { useDedupUnidentifiedChoice } from "./dedup/useDedupUnidentifiedChoice";
import { useDedupExport } from "./dedup/useDedupExport";
import { useDedupReport } from "./dedup/useDedupReport";
import { useDedupSaveLocation } from "./dedup/useDedupSaveLocation";
import { useDedupSaveToDropbox } from "./dedup/useDedupSaveToDropbox";
import DropboxSaveAction from "./dedup/DropboxSaveAction";
import ExportProgress from "./dedup/ExportProgress";
import { FORMAT_OPTIONS } from "./dedup/exportFormats";
import SessionExpiredPage from "./SessionExpiredPage";
import { prefetchRunUpdateTasks } from "@/lib/clickupRunUpdate";
import { formatElapsed } from "@/lib/useAbortableOperation";
import type { DedupExportFormat } from "@/types/api";

interface DedupResultsPageProps {
  clientId: string;
  facilityId: string;
  sessionId: string;
  onHome: () => void;
}

export default function DedupResultsPage({
  clientId,
  facilityId,
  sessionId,
  onHome,
}: DedupResultsPageProps) {
  const {
    report: loadedReport,
    loading,
    error: reportError,
    sessionExpired: reportExpired,
    cancelled: reportCancelled,
    elapsedMs: reportElapsedMs,
    cancel: cancelReport,
  } = useDedupReport(sessionId);

  const {
    exporting,
    downloadComplete,
    error: exportError,
    sessionExpired: exportExpired,
    cancelled: exportCancelled,
    elapsedMs: exportElapsedMs,
    cancelExport,
    handleExport,
  } = useDedupExport(sessionId, clientId, facilityId);

  const {
    saving,
    savedPath,
    error: saveError,
    sessionExpired: saveExpired,
    handleSave,
  } = useDedupSaveToDropbox(sessionId, clientId);

  const { defaultFolderPath } = useDedupSaveLocation(sessionId);

  const {
    updatedReport,
    busy: choosing,
    error: chooseError,
    sessionExpired: chooseExpired,
    choose: chooseUnidentified,
  } = useDedupUnidentifiedChoice(sessionId);

  // The ClickUp action sits with the save/download options; the panel it
  // opens is also offered automatically once the export is saved or
  // downloaded. One panel instance serves both, so an update made early
  // is not offered again.
  const clickUpAccess = useClickUpAccess();
  const [clickUpRequested, setClickUpRequested] = useState(false);

  // Start reading the facility's ClickUp tasks while the person reviews
  // the results, so the ClickUp panel opens instantly later.
  const clickUpAllowed = clickUpAccess.allowed;
  useEffect(() => {
    if (clickUpAllowed) void prefetchRunUpdateTasks(clientId, facilityId);
  }, [clickUpAllowed, clientId, facilityId]);

  // The user's latest choice for tenants without a customer id replaces
  // the report the page first loaded.
  const report = updatedReport ?? loadedReport;

  const [
    exportFormat,
    setExportFormat,
  ] = useState<DedupExportFormat>(
    "xlsx"
  );

  if (reportExpired || exportExpired || saveExpired || chooseExpired) {
    return (
      <SessionExpiredPage
        onHome={onHome}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 text-slate-100">
        <div>
          Running duplicate tenant check... ({formatElapsed(reportElapsedMs)})
        </div>
        <button
          onClick={cancelReport}
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    );
  }

  // The report fetch was cancelled mid-flight (rather than failing) --
  // its own distinct state, not folded into `reportError`'s banner,
  // since the user asked to stop rather than hitting a real failure.
  if (reportCancelled && !report) {
    return (
      <div className="space-y-4">
        <div className="text-amber-400">
          Duplicate tenant check cancelled.
        </div>
        <button
          onClick={onHome}
          className="rounded bg-slate-700 px-4 py-2 text-white"
        >
          Back to Company
        </button>
      </div>
    );
  }

  // Only a report failure replaces the whole page — there's nothing to
  // show without it. An export failure (below) doesn't get the same
  // treatment: it shouldn't hide results the user already has.
  if (reportError) {
    return (
      <div className="space-y-4">
        <div className="text-red-400">
          {reportError}
        </div>

        <button
          onClick={onHome}
          className="rounded bg-slate-700 px-4 py-2 text-white"
        >
          Back to Company
        </button>
      </div>
    );
  }

  // "Complete" the moment either export path succeeds -- a Dropbox-only
  // save (no local download ever clicked) is just as much a finished
  // export as a plain download is, and previously only the download
  // path flipped this, so a Dropbox-only save left the user staring at
  // the same Export Format panel with no completion state at all.
  const completed = downloadComplete || savedPath !== null;

  const noIssuesFound =
    report !== null &&
    report.flagged_groups.length ===
      0 &&
    (report.duplicate_customer_records
      ?.length ?? 0) === 0 &&
    report.typo_variant_candidates
      .length === 0 &&
    report
      .related_tenant_candidates
      .length === 0;

  return (
    <div className="mx-auto max-w-7xl text-slate-100">
      <Link
        href={`/clients/${clientId}/facilities/${facilityId}`}
        className="mb-4 inline-block text-sm text-blue-400 hover:underline"
      >
        &larr; Back to facility
      </Link>

      <h1 className="mb-8 text-4xl font-bold">
        Duplicate Tenant Check
        Results
      </h1>

      {report && (
        <>
          <DedupSummaryStats
            report={report}
          />

          {noIssuesFound && !report.unidentified ? (
            <div className="mt-8 rounded bg-green-900 p-4 text-green-200">
              ✅ No duplicate tenants
              or name variants found
              across{" "}
              {report.unique_tenants}{" "}
              unique tenants.
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <FlaggedGroupsSection
                groups={
                  report.flagged_groups
                }
              />

              <DuplicateCustomerRecordsSection
                records={
                  report.duplicate_customer_records
                }
              />

              <TypoVariantsSection
                candidates={
                  report.typo_variant_candidates
                }
              />

              <RelatedTenantsSection
                candidates={
                  report.related_tenant_candidates
                }
              />
            </div>
          )}

          {report.unidentified && (
            <div className="mt-6">
              <UnidentifiedTenantsSection
                section={report.unidentified}
                onChoose={chooseUnidentified}
                busy={choosing}
                error={chooseError}
              />
            </div>
          )}
        </>
      )}

      {exportError && (
        <div className="mt-8 rounded bg-red-900 p-3 text-red-200">
          {exportError}
        </div>
      )}

      {exportCancelled && !exporting && (
        <div className="mt-4 text-sm text-amber-400">
          Export cancelled.
        </div>
      )}

      {!completed && (
        <div className="mt-8 rounded border border-slate-700 p-4">
          <div className="mb-3 font-semibold">
            Export Format
          </div>

          {FORMAT_OPTIONS.map(
            ({ value, label }) => (
              <label
                key={value}
                className="mb-2 block"
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value={value}
                  checked={
                    exportFormat ===
                    value
                  }
                  onChange={() =>
                    setExportFormat(
                      value
                    )
                  }
                />

                <span className="ml-2">
                  {label}
                </span>
              </label>
            )
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() =>
                handleExport(
                  exportFormat
                )
              }
              disabled={exporting}
              className="rounded bg-green-600 px-5 py-3 disabled:opacity-50"
            >
              {exporting
                ? "Generating..."
                : "Download Export"}
            </button>

            <ExportProgress
              exporting={exporting}
              elapsedMs={exportElapsedMs}
              onCancel={cancelExport}
            />

            <DropboxSaveAction
              defaultFolderPath={defaultFolderPath}
              savedPath={savedPath}
              saving={saving}
              onSave={() => defaultFolderPath && handleSave(exportFormat, defaultFolderPath, facilityId)}
              sizeClassName="px-5 py-3"
            />

            {clickUpAccess.allowed && !clickUpRequested && (
              <button
                type="button"
                onClick={() => setClickUpRequested(true)}
                className="rounded border border-slate-600 px-5 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
              >
                Update ClickUp task
              </button>
            )}
          </div>

          {saveError && (
            <div className="mt-3 rounded bg-red-900 p-3 text-sm text-red-200">
              {saveError}
            </div>
          )}
        </div>
      )}

      {completed && (
        <div className="mt-8 space-y-4">
          <div className="text-xl text-green-400">
            {downloadComplete && savedPath
              ? "Export Downloaded & Saved to Dropbox"
              : downloadComplete
                ? "Export Downloaded Successfully"
                : "Export Saved to Dropbox"}
          </div>

          <div className="text-slate-300">
            This duplicate tenant check is recorded on the facility&apos;s Onboarding Work tab, where you can come
            back and review it (and its export) at any time.
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() =>
                handleExport(
                  exportFormat
                )
              }
              disabled={exporting}
              className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
            >
              {exporting
                ? "Generating..."
                : downloadComplete
                  ? "Download Again"
                  : "Download Export"}
            </button>

            <ExportProgress
              exporting={exporting}
              elapsedMs={exportElapsedMs}
              onCancel={cancelExport}
            />

            <DropboxSaveAction
              defaultFolderPath={defaultFolderPath}
              savedPath={savedPath}
              saving={saving}
              onSave={() => defaultFolderPath && handleSave(exportFormat, defaultFolderPath, facilityId)}
              sizeClassName="px-4 py-2"
            />

            <Link
              href={`/clients/${clientId}/facilities/${facilityId}?tab=onboarding_work`}
              className="rounded border border-slate-600 px-4 py-2 text-slate-200 transition-colors hover:bg-slate-800"
            >
              View in Onboarding Work
            </Link>

            <button
              onClick={onHome}
              className="rounded bg-slate-700 px-4 py-2"
            >
              Back to Company
            </button>
          </div>

          {saveError && (
            <div className="rounded bg-red-900 p-3 text-sm text-red-200">
              {saveError}
            </div>
          )}
        </div>
      )}

      {(clickUpRequested || completed) && (
        <div className="mt-6">
          <ClickUpRunUpdatePanel
            companyId={clientId}
            facilityId={facilityId}
            sessionId={sessionId}
            fileSavedToDropbox={savedPath !== null}
          />
        </div>
      )}

    </div>
  );
}
