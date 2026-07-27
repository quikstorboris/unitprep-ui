"use client";

import { useState } from "react";
import { API_URL, basename, describeFetchError, errorMessageFrom } from "@/lib/api";
import type { DiscoverResponse } from "@/types/api";

interface FormatConfirmationSectionProps {
  sessionId: string;
  discovery: DiscoverResponse;
  onDiscoveryUpdated: (discovery: DiscoverResponse) => void;
  onSessionExpired: () => void;
  onReturnToSelection: () => void;
  /** Set by the master group file section's own "Return to Unit File
   * Format" button — hides that section again so attention returns to
   * the (already-visible) completed Format summary here. Cleared by
   * this section's own "Continue" button once the user is done looking. */
  forceShowFormatConfirmation: boolean;
  onFormatConfirmationAcknowledged: () => void;
}

/**
 * Confirming or manually mapping the confirmed unit files' vendor
 * format — the second (and last) gate `UnitFileResolutionPanel` covers,
 * once file selection is done. Renders either the confirm/map UI
 * (`discovery.requires_format_resolution`) or a read-only "confirmed"
 * summary.
 */
export function FormatConfirmationSection({
  sessionId,
  discovery,
  onDiscoveryUpdated,
  onSessionExpired,
  onReturnToSelection,
  forceShowFormatConfirmation,
  onFormatConfirmationAcknowledged,
}: FormatConfirmationSectionProps) {
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

  return discovery.requires_format_resolution ? (
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
  );
}
