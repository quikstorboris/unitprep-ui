"use client";

import { useState } from "react";
import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import type { DiscoverResponse } from "@/types/api";

interface UnitFileResolutionPanelProps {
  sessionId: string;
  discovery: DiscoverResponse;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
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
 * "ready to validate": picking one file when a folder contains more than
 * one candidate (e.g. duplicate dated re-pulls of the same facility),
 * and then confirming or manually mapping that file's vendor format.
 */
export default function UnitFileResolutionPanel({
  sessionId,
  discovery,
  onDiscoveryUpdated,
  onSessionExpired,
}: UnitFileResolutionPanelProps) {
  const [
    selectedCandidate,
    setSelectedCandidate,
  ] = useState("");

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

  const handleSelectUnitFile =
    async () => {
      if (!selectedCandidate) {
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
              unit_file_name:
                selectedCandidate,
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
        setSelectError(
          describeFetchError(
            err,
            "Failed to select unit file."
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

  const missingRequiredFields =
    discovery.required_target_fields.filter(
      (field) => !mapping[field]
    );

  if (discovery.requires_unit_file_selection) {
    return (
      <div className="mt-4 rounded border border-yellow-600 p-4">
        <div className="mb-3 font-semibold text-yellow-300">
          Select Unit File
        </div>

        <p className="mb-3 text-sm text-slate-300">
          More than one unit list was
          found. This is usually
          repeated data pulls of the
          same facility — pick the one
          to use.
        </p>

        {discovery.unit_file_candidates.map(
          (candidate) => (
            <label
              key={candidate.file_name}
              className="mb-2 block"
            >
              <input
                type="radio"
                name="unitFileCandidate"
                value={
                  candidate.file_name
                }
                checked={
                  selectedCandidate ===
                  candidate.file_name
                }
                onChange={() =>
                  setSelectedCandidate(
                    candidate.file_name
                  )
                }
              />

              <span className="ml-2">
                {candidate.file_name}
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
            handleSelectUnitFile
          }
          disabled={
            !selectedCandidate ||
            selecting
          }
          className="mt-4 rounded bg-yellow-600 px-4 py-2 disabled:opacity-50"
        >
          {selecting
            ? "Selecting..."
            : "Select This File"}
        </button>

        {selectError && (
          <div className="mt-3 rounded bg-red-900 p-3 text-red-200">
            {selectError}
          </div>
        )}
      </div>
    );
  }

  if (discovery.requires_format_resolution) {
    return (
      <div className="mt-4 rounded border border-yellow-600 p-4">
        <div className="mb-3 font-semibold text-yellow-300">
          Confirm Unit File Format
        </div>

        <p className="mb-3 text-sm text-slate-300">
          {discovery.detected_vendor_name ? (
            <>
              Detected format:{" "}
              <strong>
                {
                  discovery.detected_vendor_name
                }
              </strong>
              . Confirm this, or map
              the file&apos;s columns
              manually.
            </>
          ) : (
            <>
              This file&apos;s format
              wasn&apos;t recognized —
              map its columns manually
              below.
            </>
          )}
        </p>

        <div className="flex gap-3">
          {discovery.detected_vendor_name && (
            <button
              onClick={
                handleConfirmVendor
              }
              disabled={resolving}
              className="rounded bg-green-600 px-4 py-2 disabled:opacity-50"
            >
              {resolving
                ? "Confirming..."
                : `Confirm ${discovery.detected_vendor_name}`}
            </button>
          )}

          {!showManualMapping && (
            <button
              onClick={
                openManualMapping
              }
              className="rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
            >
              Map Fields Manually
            </button>
          )}
        </div>

        {showManualMapping && (
          <div className="mt-4">
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
                        key={target}
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
                              ] || ""
                            }
                            onChange={(e) =>
                              setMapping(
                                (prev) => ({
                                  ...prev,
                                  [target]:
                                    e.target
                                      .value,
                                })
                              )
                            }
                          >
                            <option value="">
                              — none —
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
                                  {header}
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

            <button
              onClick={
                handleSubmitMapping
              }
              disabled={
                missingRequiredFields.length >
                  0 || resolving
              }
              className="mt-4 rounded bg-green-600 px-4 py-2 disabled:opacity-50"
            >
              {resolving
                ? "Saving..."
                : "Save Mapping"}
            </button>

            {missingRequiredFields.length >
              0 && (
              <div className="mt-2 text-sm text-yellow-400">
                Still need a source
                column for:{" "}
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
    );
  }

  return null;
}
