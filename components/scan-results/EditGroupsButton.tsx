"use client";
import { useSessionAction } from "@/lib/useSessionAction";
import type { ValidateResponse } from "@/types/api";

interface EditGroupsButtonProps {
  sessionId: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onIncluded: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

// Undoes a previous exclusion for every named group at once -- shown
// next to a section's preserved "Excluded Groups" list, in case
// excluding them was a mistake. Hits `/exclude-groups` with
// `excluded: false` (the same batch endpoint "Exclude All" uses, just
// reversed), which brings the groups' units back into every stage of
// validation as if they'd never been excluded.
export function EditGroupsButton({
  sessionId,
  groupNames,
  onUpdated,
  onIncluded,
  onSessionExpired,
}: EditGroupsButtonProps) {
  const {
    pending: restoring,
    error,
    run,
  } = useSessionAction(
    sessionId,
    "/exclude-groups"
  );

  const handleClick = async () => {
    const result = await run({
      group_names: groupNames,
      excluded: false,
    });

    if (result.kind === "sessionExpired") {
      onSessionExpired();
      return;
    }

    if (result.kind === "error") {
      return;
    }

    const data: ValidateResponse =
      await result.response.json();

    onIncluded(groupNames);
    onUpdated(data);
  };

  return (
    <div className="mt-3 flex items-center gap-2 border-t border-slate-700 pt-3">
      <button
        onClick={handleClick}
        disabled={
          restoring ||
          groupNames.length === 0
        }
        className="rounded bg-blue-700 px-3 py-1 text-sm disabled:opacity-50"
      >
        {restoring
          ? "Restoring..."
          : `Edit Groups (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
