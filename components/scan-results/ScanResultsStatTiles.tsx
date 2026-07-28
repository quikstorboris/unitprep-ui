import type {
  FileValidationError,
  ValidateResponse,
} from "@/types/api";

interface ScanResultsStatTilesProps {
  results: ValidateResponse;
  filesErrored: FileValidationError[];
  totalWarningItems: number;
  displayedWarningTotal: number;
  warningsAllResolved: boolean;
}

/**
 * The 5-tile summary grid (Files Checked / Errors / Warnings / Files
 * Errored / Export Status) at the top of `ScanResultsPage` — extracted
 * since it's a self-contained, purely presentational block over values
 * the page already derives, not tied to any of the page's own state or
 * handlers.
 */
export function ScanResultsStatTiles({
  results,
  filesErrored,
  totalWarningItems,
  displayedWarningTotal,
  warningsAllResolved,
}: ScanResultsStatTilesProps) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <div className="rounded border border-slate-700 p-4">
        <div className="text-sm text-slate-400">
          Files Checked
        </div>

        <div className="text-2xl font-bold">
          {results.files_checked}
        </div>
      </div>

      <div className="rounded border border-slate-700 p-4">
        <div className="text-sm text-slate-400">
          Errors
        </div>

        <div className="text-2xl font-bold text-red-400">
          {results.error_count}
        </div>
      </div>

      <div className="rounded border border-slate-700 p-4">
        <div className="text-sm text-slate-400">
          Warnings
        </div>

        <div
          className={
            warningsAllResolved
              ? "text-2xl font-bold text-slate-500"
              : "text-2xl font-bold text-yellow-400"
          }
        >
          {displayedWarningTotal}
        </div>
      </div>

      <div className="rounded border border-slate-700 p-4">
        <div className="text-sm text-slate-400">
          Files Errored
        </div>

        <div
          className={
            filesErrored.length > 0
              ? "text-2xl font-bold text-red-400"
              : "text-2xl font-bold"
          }
        >
          {filesErrored.length}
        </div>
      </div>

      <div className="rounded border border-slate-700 p-4">
        <div className="text-sm text-slate-400">
          Export Status
        </div>

        <div
          className={
            !results.ready
              ? "text-left text-2xl font-bold text-red-400"
              : totalWarningItems >
                0
              ? "text-left text-2xl font-bold text-yellow-400"
              : "text-left text-2xl font-bold"
          }
        >
          {!results.ready
            ? "❌ Blocked"
            : totalWarningItems > 0
            ? "⚠️ Resolve Warnings"
            : "✅ Allowed"}
        </div>
      </div>
    </div>
  );
}
