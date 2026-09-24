import type { FileValidationError, ValidateResponse } from "@/types/api";

interface ValidationStatusBannerProps {
  results: ValidateResponse;
  filesErrored: FileValidationError[];
}

/**
 * The single ✅/❌/⚠ banner right under ScanResultsPage's stat tiles --
 * success when there's nothing to report, a blocking error banner when
 * there are real errors or unparseable files, otherwise an advisory
 * banner when there are only warnings. Extracted since it's a pure
 * presentational read of `results`/`filesErrored`, not tied to any of
 * the page's own state or handlers.
 */
export function ValidationStatusBanner({ results, filesErrored }: ValidationStatusBannerProps) {
  if (results.issue_count === 0 && filesErrored.length === 0) {
    return <div className="mt-6 rounded bg-green-900 p-4">✅ Validation completed successfully.</div>;
  }

  if (results.error_count > 0 || filesErrored.length > 0) {
    return (
      <div className="mt-6 rounded bg-red-900 p-4">
        ❌{" "}
        {results.error_count > 0 && (
          <>
            {results.error_count} error{results.error_count === 1 ? "" : "s"}
          </>
        )}
        {results.error_count > 0 && filesErrored.length > 0 && " and "}
        {filesErrored.length > 0 && (
          <>
            {filesErrored.length} file{filesErrored.length === 1 ? "" : "s"} that could not be validated
          </>
        )}{" "}
        must be resolved before export.
      </div>
    );
  }

  if (results.issue_count > 0) {
    return <div className="mt-6 rounded bg-yellow-900 p-4">⚠ Advisory findings detected. Review recommended.</div>;
  }

  return null;
}
