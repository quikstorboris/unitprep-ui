"use client";

import { useState } from "react";
import { basename } from "@/lib/api";
import { useSessionAction } from "@/lib/useSessionAction";
import type { DiscoverResponse } from "@/types/api";

interface UnitFileSelectionSectionProps {
  sessionId: string;
  discovery: DiscoverResponse;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
  /** Precomputed by the parent panel (`discovery.requires_unit_file_selection
   * || forceShowSelection`) since a sibling section's own visibility also
   * depends on it. */
  showSelectionSection: boolean;
  forceShowSelection: boolean;
  onReturnToSelection: () => void;
  onSelectionConfirmed: () => void;
}

function formatModifiedAt(
  modifiedAt: number | null
): string {
  if (modifiedAt === null) {
    return "modified date unknown";
  }

  return new Date(
    modifiedAt
  ).toLocaleString();
}

/**
 * The checkbox picker for which discovered unit-file candidates to
 * process (a folder can hold several distinct facilities' unit files at
 * once, not just duplicate re-pulls of one facility — every confirmed
 * file becomes its own facility downstream). Once confirmed, renders as
 * a read-only summary instead — see `showSelectionSection`.
 */
export function UnitFileSelectionSection({
  sessionId,
  discovery,
  onDiscoveryUpdated,
  onSessionExpired,
  showSelectionSection,
  forceShowSelection,
  onReturnToSelection,
  onSelectionConfirmed,
}: UnitFileSelectionSectionProps) {
  const [
    checkedFiles,
    setCheckedFiles,
  ] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<
        string,
        boolean
      > = {};

      for (const candidate of discovery.unit_file_candidates) {
        // All checked by default — the common case is processing every
        // discovered unit file; unchecking is the exception.
        initial[
          candidate.file_name
        ] = true;
      }

      return initial;
    }
  );

  const {
    pending: selecting,
    error: selectError,
    run: runSelectUnitFiles,
  } = useSessionAction(
    sessionId,
    "/unit-file/select"
  );

  const checkedFileNames =
    discovery.unit_file_candidates
      .map((c) => c.file_name)
      .filter(
        (name) => checkedFiles[name]
      );

  const allChecked =
    discovery.unit_file_candidates
      .length > 0 &&
    checkedFileNames.length ===
      discovery.unit_file_candidates
        .length;

  const toggleFile = (
    fileName: string
  ) => {
    setCheckedFiles((prev) => ({
      ...prev,
      [fileName]: !prev[fileName],
    }));
  };

  const toggleAll = () => {
    const next: Record<
      string,
      boolean
    > = {};

    for (const candidate of discovery.unit_file_candidates) {
      next[candidate.file_name] =
        !allChecked;
    }

    setCheckedFiles(next);
  };

  const handleConfirmSelection =
    async () => {
      if (
        checkedFileNames.length === 0
      ) {
        return;
      }

      const result =
        await runSelectUnitFiles({
          unit_file_names:
            checkedFileNames,
        });

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

      onSelectionConfirmed();

      onDiscoveryUpdated(
        await result.response.json()
      );
    };

  return showSelectionSection ? (
    <div className="mt-4 rounded border border-yellow-600 p-4">
      <div className="mb-3 font-semibold text-yellow-300">
        Select Unit Files
      </div>

      <p className="mb-3 text-sm text-slate-300">
        {
          discovery
            .unit_file_candidates
            .length
        }{" "}
        unit file
        {discovery
          .unit_file_candidates
          .length === 1
          ? ""
          : "s"}{" "}
        found. Each checked file
        is treated as its own
        facility — uncheck any
        you don&apos;t want to
        include.
      </p>

      <label className="mb-2 block border-b border-slate-700 pb-2 font-medium">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
        />

        <span className="ml-2">
          Select All / None
        </span>
      </label>

      {discovery.unit_file_candidates.map(
        (candidate) => (
          <label
            key={
              candidate.file_name
            }
            className="mb-2 block"
          >
            <input
              type="checkbox"
              checked={
                !!checkedFiles[
                  candidate
                    .file_name
                ]
              }
              onChange={() =>
                toggleFile(
                  candidate.file_name
                )
              }
            />

            <span className="ml-2">
              {basename(
                candidate.file_name
              )}
            </span>

            <span className="ml-2 text-sm text-slate-400">
              ({candidate.detected_vendor},{" "}
              {formatModifiedAt(
                candidate.modified_at
              )}
              )
            </span>
          </label>
        )
      )}

      <button
        onClick={
          handleConfirmSelection
        }
        disabled={
          checkedFileNames.length ===
            0 || selecting
        }
        className="mt-4 rounded bg-yellow-600 px-4 py-2 disabled:opacity-50"
      >
        {selecting
          ? "Confirming..."
          : "Confirm Selection"}
      </button>

      {forceShowSelection &&
        discovery
          .selected_unit_file_names
          .length > 0 && (
          <button
            onClick={
              onReturnToSelection
            }
            disabled={selecting}
            className="mt-4 ml-3 rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
          >
            Cancel
          </button>
        )}

      {selectError && (
        <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
          {selectError}
        </div>
      )}
    </div>
  ) : (
    <div className="mt-4 rounded border border-slate-700 p-4">
      <div className="font-semibold text-green-400">
        ✅ Unit Files Selected
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          {
            discovery
              .selected_unit_file_names
              .length
          }{" "}
          file
          {discovery
            .selected_unit_file_names
            .length === 1
            ? ""
            : "s"}{" "}
          selected — click to
          review
        </summary>

        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-300">
          {discovery.selected_unit_file_names.map(
            (name) => (
              <li key={name}>
                {basename(name)}
              </li>
            )
          )}
        </ul>
      </details>
    </div>
  );
}
