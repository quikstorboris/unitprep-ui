"use client";

import { useState } from "react";
import SessionExpiredPage from "@/components/SessionExpiredPage";
import { MasterGroupFileSection } from "@/components/discovery/MasterGroupFileSection";
import UnitFileResolutionPanel from "@/components/UnitFileResolutionPanel";
import type {
  DiscoverResponse,
  UploadSummary,
} from "@/types/api";

interface DiscoveryPageProps {
  selectedFiles: FileList | null;
  sessionId: string;
  discovery: DiscoverResponse | null;
  uploadSummary: UploadSummary | null;
  loading: boolean;
  apiError: string | null;

  onFileSelection: (
    files: FileList | null
  ) => void;

  onDiscover: () => void;

  onDiscoveryUpdated: (
    discovery: DiscoverResponse
  ) => void;

  onScan: () => void;

  onBack: () => void;

  onSessionExpired: () => void;
}

export default function DiscoveryPage({
  selectedFiles,
  sessionId,
  discovery,
  uploadSummary,
  loading,
  apiError,
  onFileSelection,
  onDiscover,
  onDiscoveryUpdated,
  onScan,
  onBack,
  onSessionExpired,
}: DiscoveryPageProps) {
  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  // Gates Continue when no master group file was found — Boris wants an
  // explicit "yes, this is a net-new client" click rather than the
  // backend's own silent pass-through in that case.
  const [
    netNewAcknowledged,
    setNetNewAcknowledged,
  ] = useState(false);

  // Lifted here (rather than owned by UnitFileResolutionPanel) so both
  // that panel's own "Return to Unit Files Selection" button and this
  // page's master-group-file section's equivalent button can control the
  // same override — reopening Selection hides every later section until
  // it's reconfirmed.
  const [
    forceShowUnitFileSelection,
    setForceShowUnitFileSelection,
  ] = useState(false);

  // Set by the master-group-file section's own "Return to Unit File
  // Format" button — a *separate* override from the one above, since
  // that section's previous section is the Format step, not all the way
  // back to Selection.
  const [
    forceShowFormatConfirmation,
    setForceShowFormatConfirmation,
  ] = useState(false);

  const handleSessionExpired = () =>
    setSessionExpired(true);

  if (sessionExpired) {
    return (
      <SessionExpiredPage
        onHome={onSessionExpired}
      />
    );
  }

  const ready = discovery?.ready;

  return (
    <div className="mx-auto max-w-6xl text-slate-100">
      <div className="mb-6 flex gap-4">
        <button
          onClick={onBack}
          className="rounded bg-slate-700 px-4 py-2"
        >
          ← Back
        </button>
      </div>

      <h1 className="mb-8 text-4xl font-bold">
        UnitPrep
      </h1>

      <h2 className="mb-4 text-xl font-semibold">
        Select Source Folder
      </h2>

      <div className="rounded border border-slate-700 p-6">
        <input
          id="unitprep-folder-picker"
          type="file"
          multiple
          webkitdirectory=""
          className="hidden"
          onChange={(e) =>
            onFileSelection(
              e.target.files
            )
          }
        />

        <label
          htmlFor="unitprep-folder-picker"
          className="inline-block cursor-pointer rounded bg-slate-700 px-4 py-2 transition-colors hover:bg-slate-600"
        >
          Select Folder
        </label>

        <div className="mt-4 text-sm text-slate-300">
          {/* Raw folder-picker count, before filtering to supported
              extensions — deliberately labeled differently from the
              "Files Selected" stat below (which is the filtered,
              actually-uploaded count), so a folder with lots of
              non-data files doesn't read as files going missing. */}
          Files Found in Folder:{" "}
          <strong>
            {selectedFiles
              ? selectedFiles.length
              : 0}
          </strong>
        </div>

        {selectedFiles &&
          selectedFiles.length >
            0 && (
            <div className="mt-2 text-sm text-slate-400">
              Folder contents loaded and
              ready for upload.
            </div>
          )}

        {sessionId && (
          <div className="mt-2 text-sm text-green-400">
            Session Created
          </div>
        )}

        <button
          onClick={onDiscover}
          disabled={
            loading ||
            !selectedFiles ||
            selectedFiles.length ===
              0
          }
          className="mt-6 rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          {loading
            ? "Uploading & Discovering..."
            : "Discover"}
        </button>
      </div>

      {uploadSummary && (
        <div className="mt-6 rounded border border-slate-700 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Upload Integrity
            Verification
          </h2>

          <div className="space-y-2">
            <div>
              Files Selected:{" "}
              <strong>
                {
                  uploadSummary.files_selected
                }
              </strong>
            </div>

            <div>
              Files Uploaded:{" "}
              <strong>
                {
                  uploadSummary.files_uploaded
                }
              </strong>
            </div>

            <div>
              Files Failed:{" "}
              <strong>
                {
                  uploadSummary.files_failed
                }
              </strong>
            </div>

            <div>
              Multipart Errors:{" "}
              <strong>
                {
                  uploadSummary.multipart_errors
                }
              </strong>
            </div>
          </div>

          {uploadSummary.integrity_verified ? (
            <div className="mt-4 rounded bg-green-900 p-3 text-green-200">
              ✅ Upload Integrity Verified
            </div>
          ) : (
            <div className="mt-4 rounded bg-yellow-900 p-3 text-yellow-200">
              ⚠ Upload Integrity Check
              Failed
            </div>
          )}
        </div>
      )}

      {apiError && (
        <div className="mt-4 rounded bg-red-900 p-3 text-red-200">
          {apiError}
        </div>
      )}

      {discovery && (
        <div className="mt-8 rounded border border-slate-700 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Discovery Results
          </h2>

          <div className="space-y-3">
            <p>
              Unit Files Found:{" "}
              <strong>
                {
                  discovery.unit_files_found
                }
              </strong>
            </p>

            <p>
              Master Group Files Found:{" "}
              <strong>
                {
                  discovery.group_files_found
                }
              </strong>
            </p>

            <p>
              Odd Group Names Found:{" "}
              <strong
                className={
                  discovery
                    .uncommon_group_names
                    .length > 0
                    ? "text-yellow-400"
                    : undefined
                }
              >
                {
                  discovery
                    .uncommon_group_names
                    .length
                }
              </strong>
            </p>

            <UnitFileResolutionPanel
              sessionId={sessionId}
              discovery={discovery}
              onDiscoveryUpdated={
                onDiscoveryUpdated
              }
              onSessionExpired={
                handleSessionExpired
              }
              forceShowSelection={
                forceShowUnitFileSelection
              }
              onReturnToSelection={() =>
                setForceShowUnitFileSelection(
                  true
                )
              }
              onSelectionConfirmed={() =>
                setForceShowUnitFileSelection(
                  false
                )
              }
              forceShowFormatConfirmation={
                forceShowFormatConfirmation
              }
              onFormatConfirmationAcknowledged={() =>
                setForceShowFormatConfirmation(
                  false
                )
              }
            />

            {/* The master group file section only makes sense to act on
                once the unit file itself is settled — showing it earlier
                doesn't cause any real ordering issue (group-file
                classification is independent of unit-file resolution),
                this is purely to keep the workflow reading
                top-to-bottom. Also hidden while an earlier step is
                reopened for editing (forceShowUnitFileSelection or
                forceShowFormatConfirmation) — nothing after a reopened
                step should stay visible until that step is reconfirmed. */}
            {!discovery.requires_unit_file_selection &&
              !discovery.requires_format_resolution &&
              !forceShowUnitFileSelection &&
              !forceShowFormatConfirmation && (
                <MasterGroupFileSection
                  sessionId={sessionId}
                  discovery={discovery}
                  onDiscoveryUpdated={
                    onDiscoveryUpdated
                  }
                  onSessionExpired={
                    handleSessionExpired
                  }
                  onReturnToFormat={() =>
                    setForceShowFormatConfirmation(
                      true
                    )
                  }
                  netNewAcknowledged={
                    netNewAcknowledged
                  }
                  onNetNewAcknowledged={() =>
                    setNetNewAcknowledged(
                      true
                    )
                  }
                />
              )}

            <p>
              Status:{" "}
              {ready ? (
                <span className="text-green-400">
                  ✅ Ready
                </span>
              ) : discovery.requires_unit_file_selection ? (
                <span className="text-yellow-400">
                  Awaiting Unit File
                  Selection
                </span>
              ) : discovery.requires_format_resolution ? (
                <span className="text-yellow-400">
                  Awaiting Format
                  Confirmation
                </span>
              ) : discovery.selected_group_file_name &&
                !discovery.group_file_confirmed ? (
                <span className="text-yellow-400">
                  Awaiting Master File
                  Confirmation
                </span>
              ) : !discovery.selected_group_file_name &&
                discovery.group_files_found >
                  1 ? (
                <span className="text-yellow-400">
                  Awaiting Master File
                  Selection —{" "}
                  {
                    discovery.group_files_found
                  }{" "}
                  candidates found
                </span>
              ) : !discovery.selected_group_file_name &&
                discovery.group_files_found ===
                  0 &&
                !netNewAcknowledged ? (
                <span className="text-yellow-400">
                  Awaiting Master File
                  Selection
                </span>
              ) : discovery.unit_files_found ===
                0 ? (
                <span className="text-yellow-400">
                  No unit files found — check
                  your folder selection
                </span>
              ) : (
                <span className="text-yellow-400">
                  Not ready
                </span>
              )}
            </p>
          </div>

          <button
            onClick={onScan}
            disabled={
              !ready ||
              forceShowUnitFileSelection ||
              forceShowFormatConfirmation ||
              (uploadSummary !==
                null &&
                !uploadSummary.integrity_verified) ||
              (discovery.group_files_found ===
                0 &&
                !discovery.selected_group_file_name &&
                !netNewAcknowledged)
            }
            className="mt-6 rounded bg-green-600 px-4 py-2 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
