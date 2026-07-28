"use client";

import type { DiscoverResponse } from "@/types/api";

interface FormatConfirmedSummaryProps {
  discovery: DiscoverResponse;
  forceShowFormatConfirmation: boolean;
  resolving: boolean;
  resolveError: string | null;
  onAcknowledged: () => void;
  onChangeVendor: () => void;
  onReturnToSelection: () => void;
}

/**
 * Read-only "format confirmed" summary — extracted from
 * `FormatConfirmationSection`, which renders `FormatResolutionActiveView`
 * instead while `discovery.requires_format_resolution` is still true.
 */
export function FormatConfirmedSummary({
  discovery,
  forceShowFormatConfirmation,
  resolving,
  resolveError,
  onAcknowledged,
  onChangeVendor,
  onReturnToSelection,
}: FormatConfirmedSummaryProps) {
  return (
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
                onAcknowledged
              }
              className="rounded bg-green-700 px-3 py-1 text-sm hover:bg-green-600"
            >
              Continue
            </button>
          )}

          <button
            onClick={
              onChangeVendor
            }
            disabled={resolving}
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600 disabled:opacity-50"
          >
            {resolving
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
