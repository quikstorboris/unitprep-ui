"use client";

import { useRef, useState } from "react";
import { API_URL, describeFetchError, errorMessageFrom, parentAndBasename } from "@/lib/api";
import SessionExpiredPage from "@/components/SessionExpiredPage";
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

  const manualGroupFileInputRef =
    useRef<HTMLInputElement>(null);

  const [
    manualGroupFileUploading,
    setManualGroupFileUploading,
  ] = useState(false);

  const [
    manualGroupFileError,
    setManualGroupFileError,
  ] = useState<string | null>(null);

  const [
    confirmingGroupFile,
    setConfirmingGroupFile,
  ] = useState(false);

  // The radio pick isn't submitted until "Select" is clicked -- this is
  // local UI state only, separate from `discovery.selected_group_file_name`
  // (the actually-confirmed backend selection).
  const [
    groupFileCandidateChoice,
    setGroupFileCandidateChoice,
  ] = useState("");

  const [
    selectingGroupFile,
    setSelectingGroupFile,
  ] = useState(false);

  const [
    groupFileSelectError,
    setGroupFileSelectError,
  ] = useState<string | null>(null);

  // Set by "Choose From Discovered Files" once a candidate is already
  // selected -- reopens the radio list so the user can pick a different
  // one of the auto-discovered candidates without having to browse for
  // it manually.
  const [
    forceShowGroupFileCandidates,
    setForceShowGroupFileCandidates,
  ] = useState(false);

  const handleManualGroupFileChange =
    async (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file =
        e.target.files?.[0];

      e.target.value = "";

      if (!file || !sessionId) {
        return;
      }

      try {
        setManualGroupFileUploading(
          true
        );
        setManualGroupFileError(null);

        const formData = new FormData();
        formData.append(
          "session_id",
          sessionId
        );
        formData.append(
          "file",
          file,
          file.name
        );

        const response = await fetch(
          `${API_URL}/group-file/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(
              response
            )
          );
        }

        onDiscoveryUpdated(
          await response.json()
        );
      } catch (err) {
        setManualGroupFileError(
          describeFetchError(
            err,
            "Failed to upload the selected file."
          )
        );
      } finally {
        setManualGroupFileUploading(
          false
        );
      }
    };

  const handleConfirmGroupFile =
    async () => {
      if (!sessionId) {
        return;
      }

      try {
        setConfirmingGroupFile(true);
        setManualGroupFileError(null);

        const response = await fetch(
          `${API_URL}/group-file/confirm`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
          }
        );

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(
              response
            )
          );
        }

        onDiscoveryUpdated(
          await response.json()
        );
      } catch (err) {
        setManualGroupFileError(
          describeFetchError(
            err,
            "Failed to confirm the master group file."
          )
        );
      } finally {
        setConfirmingGroupFile(false);
      }
    };

  const handleSelectGroupFileCandidate =
    async () => {
      if (
        !groupFileCandidateChoice ||
        !sessionId
      ) {
        return;
      }

      try {
        setSelectingGroupFile(true);
        setGroupFileSelectError(null);

        const response = await fetch(
          `${API_URL}/group-file/select`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
              group_file_name:
                groupFileCandidateChoice,
            }),
          }
        );

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(
              response
            )
          );
        }

        setForceShowGroupFileCandidates(
          false
        );

        onDiscoveryUpdated(
          await response.json()
        );
      } catch (err) {
        setGroupFileSelectError(
          describeFetchError(
            err,
            "Failed to select the master group file."
          )
        );
      } finally {
        setSelectingGroupFile(false);
      }
    };

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
              onSessionExpired={() =>
                setSessionExpired(true)
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
                <div className="rounded border-2 border-yellow-500 bg-yellow-950/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-lg font-bold text-yellow-400">
                      Master Group
                      File
                    </div>

                    <button
                      onClick={() =>
                        setForceShowFormatConfirmation(
                          true
                        )
                      }
                      className="shrink-0 rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
                    >
                      Return to Unit
                      File Format
                    </button>
                  </div>

                  {discovery.group_files_found ===
                    0 &&
                    !discovery.selected_group_file_name &&
                    !netNewAcknowledged && (
                      <div className="mb-3 flex items-start gap-2 text-yellow-300">
                        <span aria-hidden="true">
                          ⚠️
                        </span>

                        <span>
                          No master
                          group file
                          found — every
                          discovered
                          group will be
                          treated as
                          net-new.
                          Expected for a
                          net-new client
                          with nothing
                          in QMS yet to
                          cross-reference
                          against.
                        </span>
                      </div>
                    )}

                  <input
                    ref={
                      manualGroupFileInputRef
                    }
                    type="file"
                    className="hidden"
                    onChange={
                      handleManualGroupFileChange
                    }
                  />

                  {discovery.group_files_found >
                    1 &&
                  (!discovery.selected_group_file_name ||
                    forceShowGroupFileCandidates) ? (
                    <div className="mt-3">
                      <p className="mb-3 text-sm text-slate-300">
                        {
                          discovery
                            .group_files_found
                        }{" "}
                        candidate master
                        group files found
                        — pick the one
                        that&apos;s
                        actually the
                        reference set for
                        this client.
                      </p>

                      {discovery.group_file_names.map(
                        (file) => (
                          <label
                            key={file}
                            className="mb-2 block"
                          >
                            <input
                              type="radio"
                              name="groupFileCandidate"
                              value={
                                file
                              }
                              checked={
                                groupFileCandidateChoice ===
                                file
                              }
                              onChange={() =>
                                setGroupFileCandidateChoice(
                                  file
                                )
                              }
                            />

                            <span className="ml-2">
                              {parentAndBasename(
                                file
                              )}
                            </span>
                          </label>
                        )
                      )}

                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={
                            handleSelectGroupFileCandidate
                          }
                          disabled={
                            !groupFileCandidateChoice ||
                            selectingGroupFile
                          }
                          className="rounded bg-yellow-600 px-4 py-2 disabled:opacity-50"
                        >
                          {selectingGroupFile
                            ? "Selecting..."
                            : "Select"}
                        </button>

                        {discovery.selected_group_file_name && (
                          <button
                            onClick={() =>
                              setForceShowGroupFileCandidates(
                                false
                              )
                            }
                            disabled={
                              selectingGroupFile
                            }
                            className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>

                      {groupFileSelectError && (
                        <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
                          {
                            groupFileSelectError
                          }
                        </div>
                      )}
                    </div>
                  ) : discovery.selected_group_file_name ? (
                    <div className="mt-3">
                      {discovery.group_file_format_valid ===
                      false ? (
                        <div className="rounded bg-red-900 p-3 text-red-200">
                          ❌ File format
                          invalid — select
                          another file.{" "}
                          <strong>
                            {
                              discovery.selected_group_file_name
                            }
                          </strong>{" "}
                          is missing one
                          or more required
                          columns (Name,
                          Description,
                          Assigned To,
                          Status, Last
                          Updated).
                        </div>
                      ) : discovery.group_file_confirmed ? (
                        <div className="rounded bg-green-900 p-3 text-green-200">
                          ✅ Master file
                          confirmed —{" "}
                          <strong>
                            {
                              discovery.selected_group_file_name
                            }
                          </strong>
                        </div>
                      ) : (
                        <div className="rounded bg-green-900 p-3 text-green-200">
                          ✅ Master file
                          is good —{" "}
                          <strong>
                            {
                              discovery.selected_group_file_name
                            }
                          </strong>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3">
                        {discovery.group_file_format_valid !==
                          false &&
                          !discovery.group_file_confirmed && (
                            <button
                              onClick={
                                handleConfirmGroupFile
                              }
                              disabled={
                                confirmingGroupFile
                              }
                              className="rounded bg-green-700 px-4 py-2 hover:bg-green-600 disabled:opacity-50"
                            >
                              {confirmingGroupFile
                                ? "Confirming..."
                                : "Confirm"}
                            </button>
                          )}

                        {discovery.group_files_found >
                          1 && (
                          <button
                            onClick={() =>
                              setForceShowGroupFileCandidates(
                                true
                              )
                            }
                            className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
                          >
                            Choose From
                            Discovered
                            Files
                          </button>
                        )}

                        <button
                          onClick={() =>
                            manualGroupFileInputRef.current?.click()
                          }
                          disabled={
                            manualGroupFileUploading
                          }
                          className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
                        >
                          {manualGroupFileUploading
                            ? "Uploading..."
                            : "Select Different File"}
                        </button>
                      </div>
                    </div>
                  ) : netNewAcknowledged ? (
                    <div className="mt-3 text-green-400">
                      ✅ Confirmed
                      net-new client —
                      every group will be
                      treated as net-new.
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-3">
                      {discovery.group_files_found ===
                        0 && (
                        <button
                          onClick={() =>
                            setNetNewAcknowledged(
                              true
                            )
                          }
                          className="rounded bg-yellow-600 px-4 py-2"
                        >
                          Net New Client
                        </button>
                      )}

                      <button
                        onClick={() =>
                          manualGroupFileInputRef.current?.click()
                        }
                        disabled={
                          manualGroupFileUploading
                        }
                        className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
                      >
                        {manualGroupFileUploading
                          ? "Uploading..."
                          : "Select File"}
                      </button>
                    </div>
                  )}

                  {manualGroupFileError && (
                    <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
                      {manualGroupFileError}
                    </div>
                  )}
                </div>
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
