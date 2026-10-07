"use client";

import { useMemo, useState } from "react";

import type { BulkTask } from "@/lib/clickupBulkCopy";
import { buildCopyGroups, type CopyNode } from "@/components/clickup/copy/copyTree";

/** The picker's tasks as the (task-less) rows `buildCopyGroups` groups. */
function asRows(tasks: BulkTask[]) {
  return tasks.map((task) => ({
    phase: task.phase,
    source: task,
    target: null,
    alternatives: [],
  }));
}

function TaskNode({
  node,
  depth,
  selectedId,
  expanded,
  onToggle,
  onSelect,
}: {
  node: CopyNode;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onSelect: (taskId: string) => void;
}) {
  const task = node.row.source;
  const open = expanded.has(task.task_id);

  return (
    <>
      <div
        className="flex items-start gap-1 py-1.5"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggle(task.task_id)}
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${task.name}`}
            className="mt-0.5 w-5 shrink-0 text-slate-400 hover:text-slate-200"
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <label className="flex min-w-0 cursor-pointer items-start gap-2 text-sm text-slate-200">
          <input
            type="radio"
            name="bulk-source-task"
            checked={selectedId === task.task_id}
            onChange={() => onSelect(task.task_id)}
            aria-label={`Copy from ${task.name}`}
            className="mt-1"
          />
          <span className="min-w-0">
            {task.name}
            {node.children.length > 0 && !open && (
              <span className="ml-2 text-xs text-slate-500">
                {node.children.length} {node.children.length === 1 ? "subtask" : "subtasks"}
              </span>
            )}
          </span>
        </label>
      </div>

      {open &&
        node.children.map((child) => (
          <TaskNode
            key={child.row.source.task_id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

/**
 * The source facility's Set Up and Migration tasks to pick one from:
 * grouped by phase (collapsible), mid-level tasks only, with subtasks
 * collapsed until expanded -- the same shape as the facility dialog.
 */
export default function BulkTaskPicker({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: BulkTask[];
  selectedId: string | null;
  onSelect: (taskId: string) => void;
}) {
  const groups = useMemo(() => buildCopyGroups(asRows(tasks)), [tasks]);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function flip(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  }

  if (groups.length === 0) {
    return <p className="text-sm text-slate-400">No Set Up or Migration tasks to copy.</p>;
  }

  return (
    <div role="radiogroup" aria-label="Task to copy" className="rounded border border-slate-800">
      {groups.map((group) => {
        const collapsed = collapsedPhases.has(group.phase);
        return (
          <section key={group.phase} className="border-b border-slate-800 last:border-b-0">
            <button
              type="button"
              onClick={() => setCollapsedPhases((current) => flip(current, group.phase))}
              aria-expanded={!collapsed}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800/50"
            >
              <span className="w-4 text-slate-400">{collapsed ? "▸" : "▾"}</span>
              {group.phase}
              <span className="text-xs font-normal text-slate-500">({group.nodes.length})</span>
            </button>

            {!collapsed && (
              <div className="px-3 pb-2">
                {group.nodes.map((node) => (
                  <TaskNode
                    key={node.row.source.task_id}
                    node={node}
                    depth={0}
                    selectedId={selectedId}
                    expanded={expanded}
                    onToggle={(key) => setExpanded((current) => flip(current, key))}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
