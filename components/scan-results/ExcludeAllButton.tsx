"use client";
import { useSessionAction } from "@/lib/useSessionAction";
import type { ValidateResponse } from "@/types/api";

interface ExcludeAllButtonProps {
  sessionId: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onExcluded: (groupNames: string[]) => void;
  onSessionExpired: () => void;
}

// Bulk-excludes every group actually reviewable in *this* section only
// (its own `reviewGroupNames`, not every group this reason's issues
// mention) — a group whose card lives in an earlier section (because
// it's also, say, odd-named) is that earlier section's to exclude, not
// this one's, so this button never reaches into another section's list.
// Some real facility files have dozens of groups sharing no more than a
// handful of units each, and excluding them one card at a time is
// exhausting. Hits `/exclude-groups` (the batch form of
// `/exclude-group`) once rather than firing one request per group.
export function ExcludeAllButton({
  sessionId,
  groupNames,
  onUpdated,
  onExcluded,
  onSessionExpired,
}: ExcludeAllButtonProps) {
  const {
    pending: excluding,
    error,
    run,
  } = useSessionAction(
    sessionId,
    "/exclude-groups"
  );

  const handleExcludeAll = async () => {
    const result = await run({
      group_names: groupNames,
      excluded: true,
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

    onExcluded(groupNames);
    onUpdated(data);
  };

  return (
    <>
      <button
        onClick={handleExcludeAll}
        disabled={
          excluding ||
          groupNames.length === 0
        }
        className="rounded bg-slate-600 px-3 py-1 text-sm leading-tight disabled:opacity-50"
      >
        {excluding
          ? "Excluding..."
          : `Exclude All (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </>
  );
}
