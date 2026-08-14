"use client";

import { basename } from "@/lib/api";
import type { DiscoverResponse } from "@/types/api";

interface FormatResolutionActiveViewProps {
  discovery: DiscoverResponse;
  resolving: boolean;
  resolveError: string | null;
  showManualMapping: boolean;
  mapping: Record<string, string>;
  missingRequiredFields: string[];
  onReturnToSelection: () => void;
  onConfirmVendor: () => void;
  onOpenManualMapping: () => void;
  onCloseManualMapping: () => void;
  onMappingChange: (
    target: string,
    source: string
  ) => void;
  onSubmitMapping: () => void;
}

/** The "Confirm {vendor}" button, identical whether shown above the
 * manual-mapping table or beside it once it's open. */
function ConfirmVendorButton({
  vendorName,
  resolving,
  disabled,
  onClick,
}: {
  vendorName: string;
  resolving: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded bg-green-600 px-4 py-2 disabled:opacity-50"
    >
      {resolving ? "Confirming..." : `Confirm ${vendorName}`}
    </button>
  );
}

/**
 * The confirm/map-manually UI shown while
 * `discovery.requires_format_resolution` is true — extracted from
 * `FormatConfirmationSection`, which renders `FormatConfirmedSummary`
 * instead once resolution is done.
 */
export function FormatResolutionActiveView({
  discovery,
  resolving,
  resolveError,
  showManualMapping,
  mapping,
  missingRequiredFields,
  onReturnToSelection,
  onConfirmVendor,
  onOpenManualMapping,
  onCloseManualMapping,
  onMappingChange,
  onSubmitMapping,
}: FormatResolutionActiveViewProps) {
  return (
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
            <ConfirmVendorButton
              vendorName={
                discovery.detected_vendor_name
              }
              resolving={resolving}
              disabled={
                resolving ||
                discovery
                  .mismatched_header_files
                  .length > 0
              }
              onClick={onConfirmVendor}
            />
          )}

          <button
            onClick={
              onOpenManualMapping
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
              <ConfirmVendorButton
                vendorName={
                  discovery.detected_vendor_name
                }
                resolving={resolving}
                disabled={
                  resolving ||
                  discovery
                    .mismatched_header_files
                    .length > 0
                }
                onClick={onConfirmVendor}
              />
            )}

            <button
              onClick={
                onCloseManualMapping
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
                            onMappingChange(
                              target,
                              e.target
                                .value
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
                onSubmitMapping
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
                onCloseManualMapping
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
  );
}
