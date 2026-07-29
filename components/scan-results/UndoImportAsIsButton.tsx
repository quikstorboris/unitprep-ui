"use client";
import { useSessionAction } from "@/lib/useSessionAction";
import type { ValidateResponse } from "@/types/api";

interface UndoImportAsIsButtonProps {
  sessionId: string;
  check: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onUnacknowledged: (
    groupNames: string[]
  ) => void;
  onSessionExpired: () => void;
}

// Undoes a previous "Import as is" acknowledgment for every named group
// at once -- mirrors `EditGroupsButton`, just against
// `/acknowledge-group-warnings` (`acknowledged: false`) instead of
// `/exclude-groups`.
export function UndoImportAsIsButton({
  sessionId,
  check,
  groupNames,
  onUpdated,
  onUnacknowledged,
  onSessionExpired,
}: UndoImportAsIsButtonProps) {
  const {
    pending: restoring,
    error,
    run,
  } = useSessionAction(
    sessionId,
    "/acknowledge-group-warnings"
  );

  const handleClick = async () => {
    const result = await run({
      check,
      group_names: groupNames,
      acknowledged: false,
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

    onUnacknowledged(groupNames);
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
          : `Undo Import As Is (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
