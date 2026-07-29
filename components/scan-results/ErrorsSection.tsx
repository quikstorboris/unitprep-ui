"use client";
import { IssueCard, issueKey } from "@/components/scan-results/IssueCard";
import type {
  ValidateResponse,
  ValidationIssue,
} from "@/types/api";

interface ErrorsSectionProps {
  sessionId: string;
  errors: ValidationIssue[];
  onCorrectionSaved: (
    result: ValidateResponse
  ) => void;
  onSessionExpired: () => void;
}

/**
 * The "Errors" accordion in ScanResultsPage's Validation Details --
 * extracted alongside `FileErrorsSection` (its "File Errors" sibling),
 * matching the role `WarningsSection` already plays for the warnings
 * side. Pure reorganization -- same shape ScanResultsPage rendered
 * inline before.
 */
export function ErrorsSection({
  sessionId,
  errors,
  onCorrectionSaved,
  onSessionExpired,
}: ErrorsSectionProps) {
  return (
    <details className="rounded border border-slate-700 p-4">
      <summary className="cursor-pointer font-semibold text-red-400">
        Errors ({errors.length})
      </summary>

      {errors.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No errors.
        </p>
      ) : (
        <ul className="mt-3 space-y-4">
          {errors.map((issue) => (
            <IssueCard
              key={issueKey(issue)}
              issue={issue}
              sessionId={sessionId}
              onCorrectionSaved={
                onCorrectionSaved
              }
              onSessionExpired={
                onSessionExpired
              }
            />
          ))}
        </ul>
      )}
    </details>
  );
}
