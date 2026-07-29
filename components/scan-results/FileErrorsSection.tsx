"use client";
import { basename } from "@/lib/api";
import type { FileValidationError } from "@/types/api";

interface FileErrorsSectionProps {
  filesErrored: FileValidationError[];
}

/**
 * The "File Errors" accordion in ScanResultsPage's Validation Details --
 * extracted alongside `ErrorsSection` (its "Errors" sibling), matching
 * the role `WarningsSection` already plays for the warnings side. Pure
 * reorganization -- same shape ScanResultsPage rendered inline before.
 */
export function FileErrorsSection({
  filesErrored,
}: FileErrorsSectionProps) {
  return (
    <details className="rounded border border-slate-700 p-4">
      <summary className="cursor-pointer font-semibold text-red-400">
        File Errors ({filesErrored.length})
      </summary>

      {filesErrored.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No file errors.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {filesErrored.map(
            (fileError, index) => (
              <li
                key={`${fileError.file_name}-${index}`}
                className="text-sm text-red-200"
              >
                <strong>
                  {basename(
                    fileError.file_name
                  )}
                </strong>{" "}
                —{" "}
                {fileError.message}
              </li>
            )
          )}
        </ul>
      )}
    </details>
  );
}
