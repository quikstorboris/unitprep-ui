"use client";

import { useState } from "react";
import { API_URL, errorMessageFrom } from "@/lib/api";
import SessionExpiredPage from "@/components/SessionExpiredPage";
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

  onScan: () => void;

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
  onScan,
  onSessionExpired,
}: DiscoveryPageProps) {
  const [
    selectedGroupFile,
    setSelectedGroupFile,
  ] = useState("");

  const [
    localReady,
    setLocalReady,
  ] = useState(false);

  const [
    selecting,
    setSelecting,
  ] = useState(false);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  const [
    groupSelectionError,
    setGroupSelectionError,
  ] = useState<string | null>(null);

  const handleGroupSelection =
    async () => {
      if (
        !selectedGroupFile ||
        !sessionId
      ) {
        return;
      }

      try {
        setSelecting(true);
        setGroupSelectionError(null);

        const response =
          await fetch(
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
                  selectedGroupFile,
              }),
            }
          );

        if (response.status === 404) {
          setSessionExpired(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await errorMessageFrom(response)
          );
        }

        setLocalReady(true);
      } catch (err) {
        setGroupSelectionError(
          err instanceof Error
            ? err.message
            : "Failed to select master file."
        );
      } finally {
        setSelecting(false);
      }
    };

  if (sessionExpired) {
    return (
      <SessionExpiredPage
        onHome={onSessionExpired}
      />
    );
  }

  const ready =
    discovery?.ready || localReady;

  return (
    <div className="mx-auto max-w-4xl text-slate-100">
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
          Files Selected:{" "}
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

            {discovery.group_files_found ===
              0 && (
              <div className="rounded border-2 border-yellow-500 bg-yellow-950/40 p-4">
                <div className="flex items-start gap-2 text-lg font-bold text-yellow-400">
                  <span aria-hidden="true">
                    ⚠️
                  </span>

                  <span>
                    No master group file
                    found — every discovered
                    group will be treated as
                    net-new. Expected for a
                    net-new client with
                    nothing in QMS yet to
                    cross-reference against.
                  </span>
                </div>

                {discovery
                  .discovered_group_names
                  .length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-yellow-300">
                      {
                        discovery
                          .discovered_group_names
                          .length
                      }{" "}
                      distinct group
                      {discovery
                        .discovered_group_names
                        .length === 1
                        ? ""
                        : "s"}{" "}
                      found — click to review
                    </summary>

                    <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-200">
                      {discovery.discovered_group_names.map(
                        (name) => (
                          <li key={name}>
                            {name}
                          </li>
                        )
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {discovery.requires_group_selection && (
              <div className="mt-4 rounded border border-yellow-600 p-4">
                <div className="mb-3 font-semibold text-yellow-300">
                  Select Reference Group
                  File
                </div>

                {discovery.group_file_names.map(
                  (file) => (
                    <label
                      key={file}
                      className="mb-2 block"
                    >
                      <input
                        type="radio"
                        name="groupFile"
                        value={file}
                        checked={
                          selectedGroupFile ===
                          file
                        }
                        onChange={() =>
                          setSelectedGroupFile(
                            file
                          )
                        }
                      />

                      <span className="ml-2">
                        {file}
                      </span>
                    </label>
                  )
                )}

                <button
                  onClick={
                    handleGroupSelection
                  }
                  disabled={
                    !selectedGroupFile ||
                    selecting
                  }
                  className="mt-4 rounded bg-yellow-600 px-4 py-2 disabled:opacity-50"
                >
                  {selecting
                    ? "Saving..."
                    : "Select Master File"}
                </button>

                {localReady && (
                  <div className="mt-3 text-green-400">
                    ✅ Master file
                    selected
                  </div>
                )}

                {groupSelectionError && (
                  <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
                    {
                      groupSelectionError
                    }
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
              ) : discovery.requires_group_selection ? (
                <span className="text-yellow-400">
                  Awaiting Master File
                  Selection
                </span>
              ) : (
                <span className="text-yellow-400">
                  No unit files found — check
                  your folder selection
                </span>
              )}
            </p>
          </div>

          <button
            onClick={onScan}
            disabled={
              !ready ||
              (uploadSummary !==
                null &&
                !uploadSummary.integrity_verified)
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
