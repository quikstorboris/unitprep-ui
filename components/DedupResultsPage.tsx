"use client";

import { useState } from "react";

import DedupSummaryStats from "./dedup/DedupSummaryStats";
import FlaggedGroupsSection from "./dedup/FlaggedGroupsSection";
import RelatedTenantsSection from "./dedup/RelatedTenantsSection";
import TypoVariantsSection from "./dedup/TypoVariantsSection";
import { useDedupExport } from "./dedup/useDedupExport";
import { useDedupReport } from "./dedup/useDedupReport";
import SessionExpiredPage from "./SessionExpiredPage";
import type { DedupExportFormat } from "@/types/api";

interface DedupResultsPageProps {
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

export default function DedupResultsPage({
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
  } = useDedupExport(sessionId);

  const [
    exportFormat,
    setExportFormat,
  ] = useState<DedupExportFormat>(
    "csv"
  );

  if (reportExpired || exportExpired) {
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

          <button
            onClick={() =>
              handleExport(
                exportFormat
              )
            }
            disabled={exporting}
            className="mt-4 rounded bg-green-600 px-5 py-3 disabled:opacity-50"
          >
            {exporting
              ? "Generating..."
              : "Download Export"}
          </button>
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

          <div className="flex gap-4">
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
