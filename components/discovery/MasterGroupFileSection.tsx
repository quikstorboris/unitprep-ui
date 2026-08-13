"use client";

import { useRef, useState } from "react";
import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { useSessionAction } from "@/lib/useSessionAction";
import { GroupFileCandidatePicker } from "@/components/discovery/GroupFileCandidatePicker";
import { GroupFileSummary } from "@/components/discovery/GroupFileSummary";
import type { DiscoverResponse } from "@/types/api";

interface MasterGroupFileSectionProps {
  sessionId: string;
  discovery: DiscoverResponse;
  onDiscoveryUpdated: (
    discovery: DiscoverResponse
  ) => void;
  onSessionExpired: () => void;
  onReturnToFormat: () => void;
  /** Gates Continue when no master group file was found — owned by the
   * parent page since its own Continue button also reads it. */
  netNewAcknowledged: boolean;
  onNetNewAcknowledged: () => void;
}

/**
 * Selecting/confirming the master (reference) group file, or explicitly
 * acknowledging a net-new client with none — only rendered once the
 * unit-file steps are settled (see `DiscoveryPage`'s own visibility
 * gate, which also hides this while an earlier step is reopened for
 * editing).
 */
export function MasterGroupFileSection({
  sessionId,
  discovery,
  onDiscoveryUpdated,
  onSessionExpired,
  onReturnToFormat,
  netNewAcknowledged,
  onNetNewAcknowledged,
}: MasterGroupFileSectionProps) {
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

  const {
    pending: confirmingGroupFile,
    error: confirmGroupFileError,
    run: runConfirmGroupFile,
  } = useSessionAction(
    sessionId,
    "/group-file/confirm"
  );

  // The radio pick isn't submitted until "Select" is clicked -- this is
  // local UI state only, separate from `discovery.selected_group_file_name`
  // (the actually-confirmed backend selection).
  const [
    groupFileCandidateChoice,
    setGroupFileCandidateChoice,
  ] = useState("");

  const {
    pending: selectingGroupFile,
    error: groupFileSelectError,
    run: runSelectGroupFileCandidate,
  } = useSessionAction(
    sessionId,
    "/group-file/select"
  );

  // Only one of the three group-file operations (manual upload, confirm,
  // select-a-candidate) can be meaningfully in flight at once against the
  // same session — each button previously disabled only its own flag, so
  // e.g. clicking "Confirm" didn't block "Select Different File" from
  // also firing before the first request landed.
  const groupFileBusy =
    manualGroupFileUploading ||
    confirmingGroupFile ||
    selectingGroupFile;

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
            // The API is a different origin (different port), so cookies
            // are withheld unless this is explicit -- without it, every
            // request looks signed-out regardless of a valid session.
            credentials: "include",
            body: formData,
          }
        );

        if (response.status === 404 || response.status === 401) {
          onSessionExpired();
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

      const result =
        await runConfirmGroupFile();

      if (
        result.kind ===
        "sessionExpired"
      ) {
        onSessionExpired();
        return;
      }

      if (result.kind === "error") {
        return;
      }

      onDiscoveryUpdated(
        await result.response.json()
      );
    };

  const handleSelectGroupFileCandidate =
    async () => {
      if (
        !groupFileCandidateChoice ||
        !sessionId
      ) {
        return;
      }

      const result =
        await runSelectGroupFileCandidate(
          {
            group_file_name:
              groupFileCandidateChoice,
          }
        );

      if (
        result.kind ===
        "sessionExpired"
      ) {
        onSessionExpired();
        return;
      }

      if (result.kind === "error") {
        return;
      }

      setForceShowGroupFileCandidates(
        false
      );

      onDiscoveryUpdated(
        await result.response.json()
      );
    };

  return (
    <div className="rounded border-2 border-yellow-500 bg-yellow-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-lg font-bold text-yellow-400">
          Master Group
          File
        </div>

        <button
          onClick={onReturnToFormat}
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
        <GroupFileCandidatePicker
          discovery={discovery}
          choice={
            groupFileCandidateChoice
          }
          onChoiceChange={
            setGroupFileCandidateChoice
          }
          onSelect={
            handleSelectGroupFileCandidate
          }
          onCancel={() =>
            setForceShowGroupFileCandidates(
              false
            )
          }
          selecting={
            selectingGroupFile
          }
          busy={groupFileBusy}
          error={
            groupFileSelectError
          }
        />
      ) : discovery.selected_group_file_name ? (
        <GroupFileSummary
          discovery={discovery}
          busy={groupFileBusy}
          confirming={
            confirmingGroupFile
          }
          uploading={
            manualGroupFileUploading
          }
          onConfirm={
            handleConfirmGroupFile
          }
          onChooseFromDiscovered={() =>
            setForceShowGroupFileCandidates(
              true
            )
          }
          onSelectDifferentFile={() =>
            manualGroupFileInputRef.current?.click()
          }
        />
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
              onClick={
                onNetNewAcknowledged
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

      {(manualGroupFileError ||
        confirmGroupFileError) && (
        <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
          {manualGroupFileError ||
            confirmGroupFileError}
        </div>
      )}
    </div>
  );
}
