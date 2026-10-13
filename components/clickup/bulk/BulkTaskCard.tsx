"use client";

import type { BulkTask, DestinationPairs } from "@/lib/clickupBulkCopy";
import type { CopyTaskInfo } from "@/lib/clickupCopy";
import type { TaskCopyState } from "./useBulkCopy";

function taskLabel(task: CopyTaskInfo): string {
  return task.parent_name ? `${task.name} — ${task.parent_name}` : task.name;
}

/** The suggestion and near misses first, then everything else. */
function options(destination: DestinationPairs): CopyTaskInfo[] {
  const preferred = [destination.target, ...destination.alternatives].filter((task) => task !== null);
  const ids = new Set(preferred.map((task) => task.task_id));
  return [...preferred, ...destination.tasks.filter((task) => !ids.has(task.task_id))];
}

/**
 * One chosen source task: its own comment (prefilled from the task's
 * latest comment, editable) and, for each facility chosen above, the task
 * the comment will be posted on (a suggestion the person can change). A
 * chosen facility with no task for this source task is skipped for it.
 */
export default function BulkTaskCard({
  task,
  state,
  ticked,
  blocked,
  focus,
  onEditComment,
  onChooseTarget,
}: {
  task: BulkTask;
  state: TaskCopyState;
  ticked: Record<string, boolean>;
  blocked: Record<string, string>;
  /** Put the cursor in the comment (only when it is the one task). */
  focus: boolean;
  onEditComment: (text: string) => void;
  onChooseTarget: (facilityId: string, targetTaskId: string | null) => void;
}) {
  const rows = (state.pairs?.destinations ?? []).filter(
    (destination) => ticked[destination.facility_id] && !blocked[destination.facility_id]
  );

  return (
    <section aria-label={`Copy of ${task.name}`} className="space-y-3 rounded border border-slate-800 p-4">
      <h3 className="text-sm font-semibold text-slate-100">{task.name}</h3>

      {state.pairsError && (
        <p role="alert" className="text-sm text-red-400">
          {state.pairsError}
        </p>
      )}
      {!state.pairs && !state.pairsError && (
        <p className="text-sm text-slate-400">Finding each facility&apos;s matching task…</p>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-slate-800 rounded border border-slate-800">
          {rows.map((destination) => {
            const target = state.targets[destination.facility_id] ?? null;

            return (
              <li
                key={destination.facility_id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-3 p-3"
              >
                <span className="min-w-0 break-words text-sm text-slate-200">{destination.facility_name}</span>

                <div className="min-w-0">
                  <select
                    aria-label={`Task in ${destination.facility_name} for ${task.name}`}
                    value={target ?? ""}
                    onChange={(event) =>
                      onChooseTarget(destination.facility_id, event.target.value === "" ? null : event.target.value)
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
                  >
                    <option value="">No task — skip this facility</option>
                    {options(destination).map((option) => (
                      <option key={option.task_id} value={option.task_id}>
                        {taskLabel(option)}
                      </option>
                    ))}
                  </select>
                  {target === null && (
                    <p role="status" className="mt-1 text-xs text-amber-300">
                      No matching task found. Choose one, or this facility is skipped for this task.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        aria-label={`Comment for ${task.name}`}
        value={state.comment}
        rows={4}
        autoFocus={focus}
        onChange={(event) => onEditComment(event.target.value)}
        placeholder={
          state.commentLoading
            ? "Loading the source comment…"
            : state.noSourceComment
              ? "The source task has no comment — type one."
              : ""
        }
        className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
      <p className="text-xs text-slate-500">
        A link to the source task is added at the bottom automatically:{" "}
        <span className="text-slate-400">Main tracker task - {task.name}</span>.
      </p>
    </section>
  );
}
