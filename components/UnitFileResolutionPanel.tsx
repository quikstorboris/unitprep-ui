"use client";

import { useState } from "react";
import { API_URL, basename, describeFetchError, errorMessageFrom } from "@/lib/api";
import type { DiscoverResponse } from "@/types/api";

interface UnitFileResolutionPanelProps {
  sessionId: string;
  discovery: DiscoverResponse;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
  // Controlled by the parent so a later section (the master group file
  // section, a sibling of this whole panel) can also trigger returning
  // here — see DiscoveryPage.tsx.
  forceShowSelection: boolean;
  onReturnToSelection: () => void;
  onSelectionConfirmed: () => void;
  // Set by the master group file section's own "Return to Unit File
  // Format" button — hides that section again so attention returns to
  // the (already-visible) completed Format summary below. Cleared by
  // this panel's own "Continue" button once the user is done looking.
  forceShowFormatConfirmation: boolean;
  onFormatConfirmationAcknowledged: () => void;
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
 * Every discovered unit file — QSX included — needs an explicit
 * confirm-or-map step before discovery can be `ready` (see
 * `unitprep-unit-group`'s `format` module). This panel covers the two
 * gates that can require user input in between "files uploaded" and
 * "ready to validate": confirming which subset of discovered candidates
 * to process (a folder can hold several distinct facilities' unit files
 * at once, not just duplicate re-pulls of one facility — every confirmed
 * file becomes its own facility downstream), and then confirming or
 * manually mapping the confirmed files' vendor format.
 *
 * Each step, once completed, renders as a read-only summary that stays
 * visible rather than disappearing — the next step appears below it. The
 * only way back into an earlier, completed step is its "Return to ..."
 * button (or, for this component's own Selection step, one on a later
 * section — see `forceShowSelection`/`onReturnToSelection`).
 */
export default function UnitFileResolutionPanel({
  sessionId,
  discovery,
  onDiscoveryUpdated,
  onSessionExpired,
  forceShowSelection,
  onReturnToSelection,
  onSelectionConfirmed,
  forceShowFormatConfirmation,
  onFormatConfirmationAcknowledged,
}: UnitFileResolutionPanelProps) {
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

  const [
    selecting,
    setSelecting,
  ] = useState(false);

  const [
    selectError,
    setSelectError,
  ] = useState<string | null>(null);

  const [
    mapping,
    setMapping,
  ] = useState<Record<string, string>>({});

  const [
    showManualMapping,
    setShowManualMapping,
  ] = useState(false);

  const [
    resolving,
    setResolving,
  ] = useState(false);

  const [
    resolveError,
    setResolveError,
  ] = useState<string | null>(null);

  const [
    resettingFormat,
    setResettingFormat,
  ] = useState(false);

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

      try {
        setSelecting(true);
        setSelectError(null);

        const response = await fetch(
          `${API_URL}/unit-file/select`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
              unit_file_names:
                checkedFileNames,
            }),
          }
        );

        if (response.status === 404) {
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

        onSelectionConfirmed();

        onDiscoveryUpdated(
          await response.json()
        );
      } catch (err) {
        setSelectError(
          describeFetchError(
            err,
            "Failed to confirm the selected unit files."
          )
        );
      } finally {
        setSelecting(false);
      }
    };

  const submitResolution = async (
    body: object
  ) => {
    try {
      setResolving(true);
      setResolveError(null);

      const response = await fetch(
        `${API_URL}/unit-file/resolve-format`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            ...body,
          }),
        }
      );

      if (response.status === 404) {
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

      // The next discovery response describes a different file (or
      // none, if everything's resolved) — any in-progress manual
      // mapping belonged to whichever file was just resolved.
      setShowManualMapping(false);
      setMapping({});

      onDiscoveryUpdated(
        await response.json()
      );
    } catch (err) {
      setResolveError(
        describeFetchError(
          err,
          "Failed to resolve the file's format."
        )
      );
    } finally {
      setResolving(false);
    }
  };

  const handleConfirmVendor = () =>
    submitResolution({
      action: "confirm",
    });

  const handleChangeVendor =
    async () => {
      try {
        setResettingFormat(true);
        setResolveError(null);

        const response = await fetch(
          `${API_URL}/unit-file/resolve-format`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
              action: "reset",
            }),
          }
        );

        if (response.status === 404) {
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
        setResolveError(
          describeFetchError(
            err,
            "Failed to reopen format resolution."
          )
        );
      } finally {
        setResettingFormat(false);
      }
    };

  const handleSubmitMapping = () => {
    const submitted =
      discovery.canonical_target_fields.map(
        (target) => ({
          target,
          source:
            mapping[target] || null,
        })
      );

    return submitResolution({
      action: "map",
      mapping: submitted,
    });
  };

  const openManualMapping = () => {
    const prefilled: Record<
      string,
      string
    > = {};

    for (const suggestion of discovery.suggested_mapping) {
      prefilled[suggestion.target] =
        suggestion.source;
    }

    setMapping(prefilled);
    setShowManualMapping(true);
  };

  const closeManualMapping = () => {
    setShowManualMapping(false);
    setMapping({});
  };

  const missingRequiredFields =
    discovery.required_target_fields.filter(
      (field) => !mapping[field]
    );

  const showSelectionSection =
    discovery
      .requires_unit_file_selection ||
    forceShowSelection;

  return (
    <>
      {showSelectionSection ? (
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
      )}

      {/* Right after Unit Files Selected, ahead of Confirm Unit File
          Format -- group names still aren't populated until format
          resolution finishes (they read the resolved UnitGroup column,
          not raw headers), so this renders nothing until that happens,
          then appears in this position once it does, one render before
          the Format summary below it. */}
      {!showSelectionSection &&
        discovery.discovered_group_names
          .length > 0 && (
          <div className="mt-4 rounded border border-slate-700 p-4">
            <div className="mb-2 flex items-start gap-2 text-sm text-yellow-300">
              <span aria-hidden="true">
                ⚠️
              </span>

              <span>
                {
                  discovery
                    .discovered_group_names
                    .length
                }{" "}
                distinct group
                name
                {discovery
                  .discovered_group_names
                  .length === 1
                  ? ""
                  : "s"}{" "}
                found across the
                confirmed unit files —
                review below,
                especially anything
                listed under Uncommon
                Group Names.
              </span>
            </div>

            <details>
              <summary className="cursor-pointer text-sm font-medium text-slate-300">
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
                found — click to
                review
              </summary>

              {discovery
                .uncommon_group_names
                .length > 0 && (
                <div className="mt-2">
                  <div className="text-sm font-semibold text-red-400">
                    Uncommon Group
                    Names
                  </div>

                  <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-red-300">
                    {discovery.uncommon_group_names.map(
                      (name) => (
                        <li key={name}>
                          {name}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-200">
                {discovery.discovered_group_names
                  .filter(
                    (name) =>
                      !discovery.uncommon_group_names.includes(
                        name
                      )
                  )
                  .map((name) => (
                    <li key={name}>
                      {name}
                    </li>
                  ))}
              </ul>
            </details>
          </div>
        )}

      {!showSelectionSection &&
        (discovery.requires_format_resolution ? (
          <div className="mt-4 rounded border border-yellow-600 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold text-yellow-300">
                Confirm Unit File
                Format
              </div>

              <button
                onClick={
                  onReturnToSelection
                }
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
              >
                Return to Unit Files
                Selection
              </button>
            </div>

            {discovery
              .mismatched_header_files
              .length > 0 && (
              <div className="mb-3 rounded bg-red-900 p-3 text-red-200">
                The confirmed unit
                files don&apos;t all
                share the same
                columns, so they
                can&apos;t be
                confirmed together.
                File
                {discovery
                  .mismatched_header_files
                  .length === 1
                  ? ""
                  : "s"}{" "}
                that don&apos;t match
                the rest:{" "}
                <strong>
                  {discovery.mismatched_header_files
                    .map(basename)
                    .join(", ")}
                </strong>
                . Return to Unit
                Files Selection and
                remove them, or map
                each file&apos;s
                columns manually.
              </div>
            )}

            <p className="mb-3 text-sm text-slate-300">
              {discovery.detected_vendor_name ? (
                <>
                  Detected format:{" "}
                  <strong>
                    {
                      discovery.detected_vendor_name
                    }
                  </strong>
                  . Confirm this, or
                  map the
                  file&apos;s columns
                  manually.
                  {discovery
                    .selected_unit_file_names
                    .length > 1 && (
                    <>
                      {" "}
                      Confirming
                      applies to
                      every selected
                      file with
                      matching
                      columns (
                      {
                        discovery
                          .selected_unit_file_names
                          .length
                      }{" "}
                      total).
                    </>
                  )}
                </>
              ) : (
                <>
                  This file&apos;s
                  format wasn&apos;t
                  recognized — map
                  its columns
                  manually below.
                </>
              )}
            </p>

            {!showManualMapping && (
              <div className="flex gap-3">
                {discovery.detected_vendor_name && (
                  <button
                    onClick={
                      handleConfirmVendor
                    }
                    disabled={
                      resolving ||
                      discovery
                        .mismatched_header_files
                        .length > 0
                    }
                    className="rounded bg-green-600 px-4 py-2 disabled:opacity-50"
                  >
                    {resolving
                      ? "Confirming..."
                      : `Confirm ${discovery.detected_vendor_name}`}
                  </button>
                )}

                <button
                  onClick={
                    openManualMapping
                  }
                  className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
                >
                  Map Fields
                  Manually
                </button>
              </div>
            )}

            {showManualMapping && (
              <div className="mt-4">
                <div className="mb-3 flex gap-3">
                  {discovery.detected_vendor_name && (
                    <button
                      onClick={
                        handleConfirmVendor
                      }
                      disabled={
                        resolving ||
                        discovery
                          .mismatched_header_files
                          .length > 0
                      }
                      className="rounded bg-green-600 px-4 py-2 disabled:opacity-50"
                    >
                      {resolving
                        ? "Confirming..."
                        : `Confirm ${discovery.detected_vendor_name}`}
                    </button>
                  )}

                  <button
                    onClick={
                      closeManualMapping
                    }
                    disabled={
                      resolving
                    }
                    className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel Mapping
                  </button>
                </div>

                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="py-2 pr-4">
                        Target Field
                      </th>
                      <th className="py-2">
                        Source Column
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {discovery.canonical_target_fields.map(
                      (target) => {
                        const isRequired =
                          discovery.required_target_fields.includes(
                            target
                          );

                        return (
                          <tr
                            key={
                              target
                            }
                            className="border-b border-slate-800"
                          >
                            <td className="py-2 pr-4">
                              {target}
                              {isRequired && (
                                <span className="ml-1 text-red-400">
                                  *
                                </span>
                              )}
                            </td>

                            <td className="py-2">
                              <select
                                className="rounded bg-slate-800 px-2 py-1"
                                value={
                                  mapping[
                                    target
                                  ] ||
                                  ""
                                }
                                onChange={(e) =>
                                  setMapping(
                                    (prev) => ({
                                      ...prev,
                                      [target]:
                                        e
                                          .target
                                          .value,
                                    })
                                  )
                                }
                              >
                                <option value="">
                                  —
                                  none
                                  —
                                </option>

                                {discovery.source_headers.map(
                                  (header) => (
                                    <option
                                      key={
                                        header
                                      }
                                      value={
                                        header
                                      }
                                    >
                                      {
                                        header
                                      }
                                    </option>
                                  )
                                )}
                              </select>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={
                      handleSubmitMapping
                    }
                    disabled={
                      missingRequiredFields.length >
                        0 ||
                      resolving
                    }
                    className="rounded bg-green-600 px-4 py-2 disabled:opacity-50"
                  >
                    {resolving
                      ? "Saving..."
                      : "Save Mapping"}
                  </button>

                  <button
                    onClick={
                      closeManualMapping
                    }
                    disabled={
                      resolving
                    }
                    className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel Mapping
                  </button>
                </div>

                {missingRequiredFields.length >
                  0 && (
                  <div className="mt-2 text-sm text-yellow-400">
                    Still need a
                    source column
                    for:{" "}
                    {missingRequiredFields.join(
                      ", "
                    )}
                  </div>
                )}
              </div>
            )}

            {resolveError && (
              <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
                {resolveError}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded border border-slate-700 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-green-400">
                ✅ Unit File Format
                Confirmed
                {discovery.confirmed_vendor_name && (
                  <>
                    {" "}
                    —{" "}
                    {
                      discovery.confirmed_vendor_name
                    }
                  </>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                {forceShowFormatConfirmation && (
                  <button
                    onClick={
                      onFormatConfirmationAcknowledged
                    }
                    className="rounded bg-green-700 px-3 py-1 text-sm hover:bg-green-600"
                  >
                    Continue
                  </button>
                )}

                <button
                  onClick={
                    handleChangeVendor
                  }
                  disabled={
                    resettingFormat
                  }
                  className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600 disabled:opacity-50"
                >
                  {resettingFormat
                    ? "Reopening..."
                    : "Change Vendor"}
                </button>

                <button
                  onClick={
                    onReturnToSelection
                  }
                  className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
                >
                  Return to Unit
                  Files Selection
                </button>
              </div>
            </div>

            {resolveError && (
              <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
                {resolveError}
              </div>
            )}
          </div>
        ))}
    </>
  );
}
