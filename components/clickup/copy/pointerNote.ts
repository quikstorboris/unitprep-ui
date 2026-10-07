import type { CopyPointerOutcome } from "@/lib/clickupCopy";

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
