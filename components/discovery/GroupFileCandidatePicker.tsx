"use client";

import { parentAndBasename } from "@/lib/api";
import type { DiscoverResponse } from "@/types/api";

interface GroupFileCandidatePickerProps {
  discovery: DiscoverResponse;
  choice: string;
  onChoiceChange: (file: string) => void;
  onSelect: () => void;
  onCancel: () => void;
  selecting: boolean;
  busy: boolean;
  error: string | null;
}

/**
 * The radio-button picker for which of several auto-discovered master
 * group file candidates is the real one — extracted from
 * `MasterGroupFileSection`, which renders this instead of
 * `GroupFileSummary` whenever there's more than one candidate and
 * nothing's been picked yet (or the user asked to change their pick via
 * "Choose From Discovered Files").
 */
export function GroupFileCandidatePicker({
  discovery,
  choice,
  onChoiceChange,
  onSelect,
  onCancel,
  selecting,
  busy,
  error,
}: GroupFileCandidatePickerProps) {
  return (
    <div className="mt-3">
      <p className="mb-3 text-sm text-slate-300">
        {discovery.group_files_found}{" "}
        candidate master group
        files found — pick the
        one that&apos;s actually
        the reference set for
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
              value={file}
              checked={
                choice === file
              }
              onChange={() =>
                onChoiceChange(file)
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
          onClick={onSelect}
          disabled={
            !choice || busy
          }
          className="rounded bg-yellow-600 px-4 py-2 disabled:opacity-50"
        >
          {selecting
            ? "Selecting..."
            : "Select"}
        </button>

        {discovery.selected_group_file_name && (
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
          {error}
        </div>
      )}
    </div>
  );
}
