"use client";

import type { ValidateResponse } from "@/types/api";

import { UndoImportAsIsButton } from "./UndoImportAsIsButton";

interface AcknowledgedGroupsListProps {
  sessionId: string;
  check: string;
  acknowledgedNames: string[];
  occurrenceCounts: Map<string, number>;
  onUpdated: (result: ValidateResponse) => void;
  onUnacknowledged: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

/**
 * A reason section's preserved "Imported As Is" list plus the
 * UndoImportAsIsButton that undoes the acknowledgment -- extracted from
 * `WarningsSection`, which rendered this inline alongside three other
 * structurally distinct sub-sections (mirrors how `GroupFileSummary`/
 * `GroupFileCandidatePicker` were split out of `MasterGroupFileSection`).
 */
export function AcknowledgedGroupsList({
  sessionId,
  check,
  acknowledgedNames,
  occurrenceCounts,
  onUpdated,
  onUnacknowledged,
  onSessionExpired,
}: AcknowledgedGroupsListProps) {
  return (
    <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3">
      <div className="mb-2 text-sm font-medium text-slate-400">
        Imported As Is ({acknowledgedNames.length})
      </div>

      <ul className="mb-3 ml-4 list-disc space-y-0.5 text-sm text-slate-400">
        {acknowledgedNames.map((name) => {
          const occurrenceCount =
            occurrenceCounts.get(name);

          return (
            <li key={name}>
              {name}
              {occurrenceCount !== undefined && (
                <span> ({occurrenceCount})</span>
              )}
            </li>
          );
        })}
      </ul>

      <UndoImportAsIsButton
        sessionId={sessionId}
        check={check}
        groupNames={acknowledgedNames}
        onUpdated={onUpdated}
        onUnacknowledged={onUnacknowledged}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
