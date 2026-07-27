"use client";
import { useSessionAction } from "@/lib/useSessionAction";
import type { ValidateResponse } from "@/types/api";

interface ImportAsIsButtonProps {
  sessionId: string;
  check: string;
  groupNames: string[];
  onUpdated: (result: ValidateResponse) => void;
  onAcknowledged: (
    groupNames: string[]
  ) => void;
  onSessionExpired: () => void;
}

// Accepts *every* group this reason flags "as is" -- deliberately
// `group.groupNames` (the reason's full raw list), not the
// section-owned-only `reviewGroupNames` `ExcludeAllButton` uses. Unlike
// excluding a shared group (which removes its units entirely, resolving
// every check that ever flagged it at once), acknowledging is per-check:
// a group shared with another reason still needs *that* reason's own
// acknowledgment (or fix, or exclude) too, even though its card only
// renders in whichever section owns it -- scoping this button to the
// owned-only subset would silently leave shared groups half-resolved
// forever, keeping Continue disabled even after both sections' buttons
// were clicked.
export function ImportAsIsButton({
  sessionId,
  check,
  groupNames,
  onUpdated,
  onAcknowledged,
  onSessionExpired,
}: ImportAsIsButtonProps) {
  const {
    pending: acknowledging,
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
      acknowledged: true,
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

    onAcknowledged(groupNames);
    onUpdated(data);
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={
          acknowledging ||
          groupNames.length === 0
        }
        className="rounded bg-slate-700 px-3 py-1 text-sm leading-tight disabled:opacity-50"
      >
        {acknowledging
          ? "Importing..."
          : `Import as is (${groupNames.length})`}
      </button>

      {error && (
        <span className="text-sm text-red-400">
          {error}
        </span>
      )}
    </>
  );
}
