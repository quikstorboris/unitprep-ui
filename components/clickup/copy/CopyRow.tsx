"use client";

import type { CopyTaskInfo } from "@/lib/clickupCopy";
import type { CopyNode } from "./copyTree";
import { pointerNote } from "./pointerNote";
import type { RowState } from "./useCopyComments";

/** Source | target | comment | confirm. Shared by the row and its header. */
export const COPY_GRID = "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_6.5rem] gap-3";

function taskLabel(task: CopyTaskInfo): string {
  return task.parent_name ? `${task.name} — ${task.parent_name}` : task.name;
}

/**
 * One source task and the counterpart it will be copied to. The comment
 * box is editable plain text (no attachments) and the person's own edits
 * are what is posted. Subtasks (`children`) stay hidden until the row is
 * expanded.
 */
export default function CopyRow({
  node,
  depth,
  rows,
  targetTasks,
  expanded,
  autoFocusKey,
  onToggle,
  onChooseTarget,
  onComment,
  onConfirm,
}: {
  node: CopyNode;
  depth: number;
  rows: Record<string, RowState>;
  targetTasks: CopyTaskInfo[];
  expanded: Set<string>;
  /** The row whose comment box takes the cursor when the dialog opens. */
  autoFocusKey: string | null;
  onToggle: (node: CopyNode) => void;
  onChooseTarget: (key: string, targetTaskId: string | null) => void;
  onComment: (key: string, comment: string) => void;
  onConfirm: (key: string) => void;
}) {
  const key = node.row.source.task_id;
  const state = rows[key];
  if (!state) return null;

  const isOpen = expanded.has(key);
  const note = state.copyState === "copied" ? pointerNote(state.pointer) : null;

  // The suggestion and near misses first, then everything else.
  const preferred = [node.row.target, ...node.row.alternatives].filter((task) => task !== null);
  const preferredIds = new Set(preferred.map((task) => task.task_id));
  const options = [...preferred, ...targetTasks.filter((task) => !preferredIds.has(task.task_id))];

  const confirmLabel =
    state.copyState === "copying" ? "Copying…" : state.copyState === "copied" ? "Copied" : "Confirm";
  const canConfirm =
    state.targetTaskId !== null &&
    state.comment.trim() !== "" &&
    state.copyState !== "copying" &&
    state.copyState !== "copied";

  return (
    <>
      <div className={`${COPY_GRID} items-start border-t border-slate-800 py-3`}>
        <div className="min-w-0" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          <div className="flex items-start gap-1">
            {node.children.length > 0 ? (
              <button
                type="button"
                onClick={() => onToggle(node)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.row.source.name}`}
                className="mt-0.5 w-5 shrink-0 text-slate-400 hover:text-slate-200"
              >
                {isOpen ? "▾" : "▸"}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <div className="min-w-0">
              <a
                href={node.row.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-200 hover:underline"
              >
                {node.row.source.name}
              </a>
              {node.children.length > 0 && !isOpen && (
                <p className="text-xs text-slate-500">
                  {node.children.length} {node.children.length === 1 ? "subtask" : "subtasks"}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <select
            aria-label={`Target task for ${node.row.source.name}`}
            value={state.targetTaskId ?? ""}
            onChange={(event) => onChooseTarget(key, event.target.value === "" ? null : event.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="">No match — skip</option>
            {options.map((task) => (
              <option key={task.task_id} value={task.task_id}>
                {taskLabel(task)}
              </option>
            ))}
          </select>
          {state.targetTaskId === null && <p className="mt-1 text-xs text-slate-500">No counterpart found.</p>}
        </div>

        <div className="min-w-0">
          <textarea
            aria-label={`Comment for ${node.row.source.name}`}
            value={state.comment}
            autoFocus={key === autoFocusKey}
            rows={2}
            disabled={state.targetTaskId === null}
            placeholder={
              state.loadState === "loading"
                ? "Loading the source comment…"
                : state.noSourceComment
                  ? "The source task has no comment — type one."
                  : ""
            }
            onChange={(event) => onComment(key, event.target.value)}
            className="w-full resize-y rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 disabled:opacity-50"
          />
          {state.alreadyCopied && state.copyState !== "copied" && (
            <p className="mt-1 text-xs text-amber-400">Looks already copied to this task.</p>
          )}
          {state.copyState === "copied" && <p className="mt-1 text-xs text-green-400">Copied.</p>}
          {note && <p className={`text-xs ${note.failed ? "text-red-400" : "text-slate-400"}`}>{note.text}</p>}
          {state.message && (
            <p role="alert" className="mt-1 text-xs text-red-400">
              {state.message}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label={`${confirmLabel} ${node.row.source.name}`}
          disabled={!canConfirm}
          onClick={() => onConfirm(key)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {confirmLabel}
        </button>
      </div>

      {isOpen &&
        node.children.map((child) => (
          <CopyRow
            key={child.row.source.task_id}
            node={child}
            depth={depth + 1}
            rows={rows}
            targetTasks={targetTasks}
            expanded={expanded}
            autoFocusKey={autoFocusKey}
            onToggle={onToggle}
            onChooseTarget={onChooseTarget}
            onComment={onComment}
            onConfirm={onConfirm}
          />
        ))}
    </>
  );
}
