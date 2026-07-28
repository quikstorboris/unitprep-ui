"use client";

import type { DiscoverResponse } from "@/types/api";

interface GroupFileSummaryProps {
  discovery: DiscoverResponse;
  busy: boolean;
  confirming: boolean;
  uploading: boolean;
  onConfirm: () => void;
  onChooseFromDiscovered: () => void;
  onSelectDifferentFile: () => void;
}

/**
 * Read-only status (format invalid / confirmed / good) plus the
 * Confirm / Choose-From-Discovered / Select-Different-File actions for
 * whichever master group file is currently selected — extracted from
 * `MasterGroupFileSection`, which renders this once
 * `discovery.selected_group_file_name` is set (as opposed to
 * `GroupFileCandidatePicker`, shown before a pick is made).
 */
export function GroupFileSummary({
  discovery,
  busy,
  confirming,
  uploading,
  onConfirm,
  onChooseFromDiscovered,
  onSelectDifferentFile,
}: GroupFileSummaryProps) {
  return (
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
          is missing one or
          more required
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
          ✅ Master file is
          good —{" "}
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
              onClick={onConfirm}
              disabled={busy}
              className="rounded bg-green-700 px-4 py-2 hover:bg-green-600 disabled:opacity-50"
            >
              {confirming
                ? "Confirming..."
                : "Confirm"}
            </button>
          )}

        {discovery.group_files_found >
          1 && (
          <button
            onClick={
              onChooseFromDiscovered
            }
            disabled={busy}
            className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
          >
            Choose From
            Discovered Files
          </button>
        )}

        <button
          onClick={
            onSelectDifferentFile
          }
          disabled={busy}
          className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
        >
          {uploading
            ? "Uploading..."
            : "Select Different File"}
        </button>
      </div>
    </div>
  );
}
