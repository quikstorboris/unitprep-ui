"use client";

import { useState } from "react";

import { DropboxLogo } from "./icons/DropboxLogo";
import DedupSummaryStats from "./dedup/DedupSummaryStats";
import FlaggedGroupsSection from "./dedup/FlaggedGroupsSection";
import RelatedTenantsSection from "./dedup/RelatedTenantsSection";
import TypoVariantsSection from "./dedup/TypoVariantsSection";
import { useDedupExport } from "./dedup/useDedupExport";
import { useDedupReport } from "./dedup/useDedupReport";
import { useDedupSaveLocation } from "./dedup/useDedupSaveLocation";
import { useDedupSaveToDropbox } from "./dedup/useDedupSaveToDropbox";
import SessionExpiredPage from "./SessionExpiredPage";
import { dropboxFolderWebUrl, dropboxParentFolder } from "@/lib/dropbox";
import type { DedupExportFormat } from "@/types/api";

interface DedupResultsPageProps {
  clientId: string;
  sessionId: string;
  onHome: () => void;
}

const FORMAT_OPTIONS: Array<{
  value: DedupExportFormat;
  label: string;
}> = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  {
    value: "both",
    label: "Both (as a .zip)",
  },
];

interface DropboxSaveActionProps {
  /** `null`/`undefined` once saved -- there's nothing left to click,
   * `DedupSaveAction` renders the "Open Destination Folder" link
   * instead. `null` before a save location is even known (e.g. a
   * locally-uploaded session) hides the whole action. */
  defaultFolderPath: string | null | undefined;
  savedPath: string | null;
  saving: boolean;
  onSave: () => void;
  /** Padding classes only -- lets each call site match its own sibling
   * buttons' size (the Export Format panel's own buttons are bigger
   * than Download Again/Home's). */
  sizeClassName: string;
}

/**
 * One-click "Save to Facility Folder" -> "Open Destination Folder" pair,
 * shared between the pre- and post-local-download panels below (saving
 * to Dropbox is independent of downloading locally -- a user may want
 * both, so this must stay available in either state, not disappear once
 * `downloadComplete`).
 */
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

export default function DedupResultsPage({
  clientId,
  sessionId,
  onHome,
}: DedupResultsPageProps) {
  const {
    report,
    loading,
    error: reportError,
    sessionExpired: reportExpired,
  } = useDedupReport(sessionId);

  const {
    exporting,
    downloadComplete,
    error: exportError,
    sessionExpired: exportExpired,
    handleExport,
  } = useDedupExport(sessionId, clientId);

  const {
    saving,
    savedPath,
    error: saveError,
    sessionExpired: saveExpired,
    handleSave,
  } = useDedupSaveToDropbox(sessionId);

  const { defaultFolderPath } = useDedupSaveLocation(sessionId);

  const [
    exportFormat,
    setExportFormat,
  ] = useState<DedupExportFormat>(
    "csv"
  );

  if (reportExpired || exportExpired || saveExpired) {
    return (
      <SessionExpiredPage
        onHome={onHome}
      />
    );
  }

  if (loading) {
    return (
      <div className="text-slate-100">
        Running duplicate tenant
        check...
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
          Home
        </button>
      </div>
    );
  }

  const noIssuesFound =
    report !== null &&
    report.flagged_groups.length ===
      0 &&
    report.typo_variant_candidates
      .length === 0 &&
    report
      .related_tenant_candidates
      .length === 0;

  return (
    <div className="mx-auto max-w-7xl text-slate-100">
      <h1 className="mb-8 text-4xl font-bold">
        Duplicate Tenant Check
        Results
      </h1>

      {report && (
        <>
          <DedupSummaryStats
            report={report}
          />

          {noIssuesFound ? (
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
        </>
      )}

      {exportError && (
        <div className="mt-8 rounded bg-red-900 p-3 text-red-200">
          {exportError}
        </div>
      )}

      {!downloadComplete && (
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

            <DropboxSaveAction
              defaultFolderPath={defaultFolderPath}
              savedPath={savedPath}
              saving={saving}
              onSave={() => defaultFolderPath && handleSave(exportFormat, defaultFolderPath)}
              sizeClassName="px-5 py-3"
            />
          </div>

          {saveError && (
            <div className="mt-3 rounded bg-red-900 p-3 text-sm text-red-200">
              {saveError}
            </div>
          )}
        </div>
      )}

      {downloadComplete && (
        <div className="mt-8 space-y-4">
          <div className="text-xl text-green-400">
            Export Downloaded
            Successfully
          </div>

          <div className="text-slate-300">
            Your duplicate tenant
            check export has been
            generated and
            downloaded.
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() =>
                handleExport(
                  exportFormat
                )
              }
              className="rounded bg-blue-600 px-4 py-2"
            >
              Download Again
            </button>

            <DropboxSaveAction
              defaultFolderPath={defaultFolderPath}
              savedPath={savedPath}
              saving={saving}
              onSave={() => defaultFolderPath && handleSave(exportFormat, defaultFolderPath)}
              sizeClassName="px-4 py-2"
            />

            <button
              onClick={onHome}
              className="rounded bg-slate-700 px-4 py-2"
            >
              Home
            </button>
          </div>

          {saveError && (
            <div className="rounded bg-red-900 p-3 text-sm text-red-200">
              {saveError}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
