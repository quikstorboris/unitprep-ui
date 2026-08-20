"use client";

import { useState } from "react";

import { useFileUploadAction } from "@/lib/useFileUploadAction";
import { stashDedupReport } from "@/lib/dedupReportCache";
import type { DedupCheckResponse, DedupDetectVendorResponse } from "@/types/api";

// Extensions the backend can actually parse — `DedupSessionService::
// create_session` (unitprep-api/src/application/dedup_session_service.rs)
// calls the same multi-format `parse_document` dispatch Group Prep's
// upload uses, not a CSV-only parser, so this mirrors
// unit-groups/page.tsx's own SUPPORTED_EXTENSIONS rather than trusting
// the file picker's `accept` attribute alone (a browser hint the user
// can bypass, e.g. via "All Files").
const SUPPORTED_EXTENSIONS = [
  ".csv",
  ".xlsx",
  ".xls",
];

function isSupportedFile(
  file: File
): boolean {
  const name =
    file.name.toLowerCase();

  return SUPPORTED_EXTENSIONS.some(
    (ext) => name.endsWith(ext)
  );
}

interface DedupUploadPageProps {
  onChecked: (sessionId: string) => void;
}

export default function DedupUploadPage({
  onChecked,
}: DedupUploadPageProps) {
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [apiError, setApiError] =
    useState<string | null>(null);

  // `undefined` = not checked yet for the current file, `null` =
  // checked and no registered vendor matched. Distinct from `apiError`
  // (a real request failure) -- an unrecognized file is a normal,
  // expected outcome of detection succeeding, not an error.
  const [vendorName, setVendorName] =
    useState<string | null | undefined>(undefined);

  const [vendorConfirmed, setVendorConfirmed] =
    useState(false);

  const { pending: loading, run } =
    useFileUploadAction("/dedup/check");

  const { pending: detecting, run: runDetectVendor } =
    useFileUploadAction("/dedup/detect-vendor");

  const detectVendor = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const result = await runDetectVendor(formData);

    if (result.kind === "sessionExpired") {
      // Vendor detection doesn't touch a session, so this can only mean
      // the caller themselves is no longer authenticated -- surfaced the
      // same way the check itself would.
      setApiError("Your session has expired — please try again.");
      return;
    }

    if (result.kind === "error") {
      setApiError(result.message);
      return;
    }

    const data: DedupDetectVendorResponse = await result.response.json();
    setVendorName(data.vendor_name);
  };

  const handleFileSelection = (
    files: FileList | null
  ) => {
    const file =
      files && files.length > 0
        ? files[0]
        : null;

    setVendorName(undefined);
    setVendorConfirmed(false);

    if (file && !isSupportedFile(file)) {
      setSelectedFile(null);
      setApiError(
        `"${file.name}" isn't a supported file type — select a .csv, .xlsx, or .xls file.`
      );
      return;
    }

    setSelectedFile(file);
    setApiError(null);

    if (file) {
      // Fire-and-forget: `detectVendor` owns its own error/state
      // handling, and the user can't do anything else with this file
      // (Run Check stays disabled) until it settles anyway.
      void detectVendor(file);
    }
  };

  const handleCheck = async () => {
    if (!selectedFile) {
      setApiError(
        "Please select a CSV file before continuing."
      );

      return;
    }

    setApiError(null);

    const formData = new FormData();

    formData.append(
      "file",
      selectedFile,
      selectedFile.name
    );

    const result = await run(formData);

    if (result.kind === "sessionExpired") {
      setApiError(
        "Your session has expired — please try again."
      );

      return;
    }

    if (result.kind === "error") {
      setApiError(result.message);
      return;
    }

    const data: DedupCheckResponse =
      await result.response.json();

    // The results page (a moment away, via onChecked's navigation)
    // would otherwise re-fetch this exact report over POST
    // /dedup/report -- stash it so useDedupReport can use it directly
    // instead of a second round trip for data already in hand.
    stashDedupReport(data.session_id, data.report);

    onChecked(data.session_id);
  };

  // Run Check stays disabled until the user has explicitly confirmed a
  // recognized vendor -- mirrors Group Prep's own recognize-then-confirm
  // flow, applied consistently here rather than treating dedup's common
  // case (QSX) as needing no confirmation. `/dedup/check` re-detects the
  // vendor itself when it runs regardless -- this gate is a UX
  // checkpoint, not something the backend trusts.
  const canRunCheck =
    !loading && !!selectedFile && vendorConfirmed;

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold">
        Duplicate Tenant Check
      </h1>

      <h2 className="mb-4 text-xl font-semibold">
        Select QMS End Users Export
      </h2>

      <div className="rounded border border-slate-700 p-6">
        <input
          id="dedup-file-picker"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) =>
            handleFileSelection(
              e.target.files
            )
          }
        />

        <label
          htmlFor="dedup-file-picker"
          className="inline-block cursor-pointer rounded bg-slate-700 px-4 py-2 transition-colors hover:bg-slate-600"
        >
          Select File
        </label>

        <div className="mt-4 text-sm text-slate-300">
          File Selected:{" "}
          <strong>
            {selectedFile
              ? selectedFile.name
              : "None"}
          </strong>
        </div>

        {selectedFile && detecting && (
          <div className="mt-2 text-sm text-slate-400">
            Checking vendor format...
          </div>
        )}

        {selectedFile && !detecting && vendorName !== undefined && (
          <div className="mt-2 text-sm">
            {vendorName ? (
              <>
                <div className="text-slate-300">
                  Vendor: <strong>{vendorName}</strong>
                </div>
                <label className="mt-2 flex items-center gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={vendorConfirmed}
                    onChange={(e) =>
                      setVendorConfirmed(e.target.checked)
                    }
                  />
                  This is the correct vendor
                </label>
              </>
            ) : (
              <div className="text-amber-400">
                Unrecognized file — this file&apos;s columns don&apos;t
                match a known vendor format (QSX, Easy Storage
                Solutions). Run Check is disabled.
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleCheck}
          disabled={!canRunCheck}
          className="mt-6 rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          {loading
            ? "Uploading & Checking..."
            : "Run Check"}
        </button>
      </div>

      {apiError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">
          {apiError}
        </div>
      )}
    </div>
  );
}
