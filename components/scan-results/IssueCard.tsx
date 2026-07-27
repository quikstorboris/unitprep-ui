import { basename } from "@/lib/api";
import type {
  ValidateResponse,
  ValidationIssue,
} from "@/types/api";

import { CorrectionField } from "./CorrectionField";
import { ExemptButton } from "./ExemptButton";

// A stable identity for a `ValidationIssue`, since the backend doesn't
// assign one. Used as the list key for `IssueCard` so that saving a
// correction (which drops the fixed issue out of `results.issues` and
// shifts every later issue's array index) can't cause React to reuse an
// `IssueCard`/`CorrectionField`/`ExemptButton` instance — and the
// "✓ saved" state or typed value it holds — for what is now a different,
// still-unresolved issue.
export function issueKey(
  issue: ValidationIssue
): string {
  return `${issue.file_name}::${issue.description}::${issue.affected_unit_ids.join(",")}`;
}

export function IssueCard({
  issue,
  sessionId,
  onCorrectionSaved,
  onSessionExpired,
}: {
  issue: ValidationIssue;
  sessionId: string;
  onCorrectionSaved: (
    result: ValidateResponse
  ) => void;
  onSessionExpired: () => void;
}) {
  return (
    <li className="rounded bg-slate-800 p-3">
      <div>
        <strong>
          {basename(
            issue.file_name
          )}
        </strong>
      </div>

      <div className="mt-1">
        <span
          className={
            issue.severity === "Error"
              ? "font-semibold text-red-400"
              : "font-semibold text-yellow-400"
          }
        >
          [{issue.severity}]
        </span>{" "}
        {issue.description}
      </div>

      <div className="mt-1 text-sm text-slate-300">
        {issue.detail}
      </div>

      {(issue.correctable_fields.length >
        0 ||
        issue.exemptable) && (
        <div className="mt-3 space-y-3 border-t border-slate-700 pt-3">
          {issue.affected_unit_ids.map(
            (unitId) => (
              <div
                key={unitId}
                className="space-y-2"
              >
                <div className="text-sm text-slate-400">
                  Unit {unitId}
                </div>

                {issue.correctable_fields.map(
                  (field) => (
                    <CorrectionField
                      key={field}
                      sessionId={
                        sessionId
                      }
                      fileName={
                        issue.file_name
                      }
                      unitNumber={
                        unitId
                      }
                      field={field}
                      onSaved={
                        onCorrectionSaved
                      }
                      onSessionExpired={
                        onSessionExpired
                      }
                    />
                  )
                )}

                {issue.exemptable && (
                  <ExemptButton
                    sessionId={
                      sessionId
                    }
                    fileName={
                      issue.file_name
                    }
                    unitNumber={unitId}
                    onExempted={
                      onCorrectionSaved
                    }
                    onSessionExpired={
                      onSessionExpired
                    }
                  />
                )}
              </div>
            )
          )}
        </div>
      )}
    </li>
  );
}
