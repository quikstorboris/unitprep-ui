"use client";

import type { ValidateResponse } from "@/types/api";

import { EditGroupsButton } from "./EditGroupsButton";

interface ExcludedGroupsListProps {
  sessionId: string;
  excludedNames: string[];
  occurrenceCounts: Map<string, number>;
  onUpdated: (result: ValidateResponse) => void;
  onIncluded: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

/**
 * A reason section's preserved "Excluded Groups" list plus the
 * EditGroupsButton that undoes the exclusion -- extracted from
 * `WarningsSection`, which rendered this inline alongside three other
 * structurally distinct sub-sections (mirrors how `GroupFileSummary`/
 * `GroupFileCandidatePicker` were split out of `MasterGroupFileSection`).
 */
export function ExcludedGroupsList({
  sessionId,
  excludedNames,
  occurrenceCounts,
  onUpdated,
  onIncluded,
  onSessionExpired,
}: ExcludedGroupsListProps) {
  return (
    <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3">
      <div className="mb-2 text-sm font-medium text-slate-400">
        Excluded Groups ({excludedNames.length})
      </div>

      <ul className="mb-3 ml-4 list-disc space-y-0.5 text-sm text-slate-400">
        {excludedNames.map((name) => {
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

      <EditGroupsButton
        sessionId={sessionId}
        groupNames={excludedNames}
        onUpdated={onUpdated}
        onIncluded={onIncluded}
        onSessionExpired={onSessionExpired}
      />
    </div>
  );
}
