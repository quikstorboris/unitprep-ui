"use client";

import type { CopyItemResult } from "@/lib/clickupCopy";
import { completedNote, pointerNote } from "@/components/clickup/copy/pointerNote";

/**
 * What happened to each destination of a copy: its comment, and the
 * "main task list" note, and whether the task was set complete (when that
 * was asked for). A failed row says why (usually "access denied"),
 * and copying again to just those facilities is safe -- the ones that
 * worked are flagged as already copied.
 */
export default function CopyResults({ results }: { results: CopyItemResult[] }) {
  return (
    <ul className="divide-y divide-slate-800 rounded border border-slate-800">
      {results.map((result) => {
        const note = result.comment.ok ? pointerNote(result.pointer) : null;
        const done = completedNote(result.completed);
        return (
          <li key={`${result.facility_id ?? ""}-${result.target_task_id}`} className="px-3 py-2 text-sm">
            <span className={result.comment.ok ? "text-green-400" : "text-red-400"}>
              {result.comment.ok ? "✓" : "✗"}
            </span>{" "}
            <span className="text-slate-200">{result.facility_name ?? result.target_task_id}</span>
            {!result.comment.ok && result.comment.message && (
              <span className="text-red-400"> — {result.comment.message}</span>
            )}
            {note && (
              <span className={note.failed ? "text-red-400" : "text-slate-500"}> · {note.text}</span>
            )}
            {done && (
              <span className={done.failed ? "text-red-400" : "text-slate-500"}> · {done.text}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
