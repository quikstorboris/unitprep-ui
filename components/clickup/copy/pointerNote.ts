import type { CopyOutcome, CopyPointerOutcome } from "@/lib/clickupCopy";

/** What to tell the person about the once-per-task "main task list" note
 * after a comment was copied, or null when there is nothing to say (no
 * parent designated, or the parent's own task). */
export function pointerNote(pointer: CopyPointerOutcome | null): { text: string; failed: boolean } | null {
  if (!pointer) return null;

  switch (pointer.state) {
    case "posted":
      return { text: "Main-list note added.", failed: false };
    case "already_present":
      return { text: "Main-list note was already there.", failed: false };
    case "failed":
      return { text: `Main-list note failed: ${pointer.message ?? "unknown error"}`, failed: true };
    default:
      return null;
  }
}

/** What to tell the person about completing the task, or null when
 * completing was not asked for (or the comment did not go through). */
export function completedNote(completed: CopyOutcome | null | undefined): { text: string; failed: boolean } | null {
  if (!completed) return null;

  return completed.ok
    ? { text: "Task marked complete.", failed: false }
    : { text: `Not marked complete: ${completed.message ?? "unknown error"}`, failed: true };
}
