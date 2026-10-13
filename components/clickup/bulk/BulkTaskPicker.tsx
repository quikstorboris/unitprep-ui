"use client";

import { useMemo, useState } from "react";

import type { BulkTask } from "@/lib/clickupBulkCopy";
import { buildCopyGroups, type CopyNode } from "@/components/clickup/copy/copyTree";

/** The picker's tasks as the (task-less) rows `buildCopyGroups` groups. */
function asRows(tasks: BulkTask[]) {
  return tasks.map((task) => ({
    phase: task.phase,
    phase_order: task.phase_order,
    source: task,
    target: null,
    alternatives: [],
  }));
}

const linkButton = "text-xs text-slate-400 transition-colors hover:text-slate-200 hover:underline";

function TaskNode({
  node,
  depth,
  selected,
  expanded,
  onToggleExpanded,
  onToggleTask,
}: {
  node: CopyNode;
  depth: number;
  selected: Set<string>;
  expanded: Set<string>;
  onToggleExpanded: (key: string) => void;
  onToggleTask: (taskId: string) => void;
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
            onClick={() => onToggleExpanded(task.task_id)}
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
            type="checkbox"
            checked={selected.has(task.task_id)}
            onChange={() => onToggleTask(task.task_id)}
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
            selected={selected}
            expanded={expanded}
            onToggleExpanded={onToggleExpanded}
            onToggleTask={onToggleTask}
          />
        ))}
    </>
  );
}

/**
 * The source facility's tasks to pick from -- any number of them: grouped
 * by phase (collapsible), mid-level tasks only, with subtasks collapsed
 * until expanded -- the same shape as the facility dialog. Each phase can
 * select or clear all of its tasks at once.
 */
export default function BulkTaskPicker({
  tasks,
  selectedIds,
  onToggle,
  onSetMany,
}: {
  tasks: BulkTask[];
  selectedIds: string[];
  onToggle: (taskId: string) => void;
  onSetMany: (taskIds: string[], selected: boolean) => void;
}) {
  const groups = useMemo(() => buildCopyGroups(asRows(tasks)), [tasks]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function flip(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  }

  if (groups.length === 0) {
    return <p className="text-sm text-slate-400">No tasks to copy.</p>;
  }

  return (
    <div role="group" aria-label="Tasks to copy" className="rounded border border-slate-800">
      {groups.map((group) => {
        const collapsed = collapsedPhases.has(group.phase);
        const ids = group.nodes.map((node) => node.row.source.task_id);
        return (
          <section key={group.phase} className="border-b border-slate-800 last:border-b-0">
            <div className="flex items-center gap-3 pr-3 hover:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setCollapsedPhases((current) => flip(current, group.phase))}
                aria-expanded={!collapsed}
                className="flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-200"
              >
                <span className="w-4 text-slate-400">{collapsed ? "▸" : "▾"}</span>
                {group.phase}
                <span className="text-xs font-normal text-slate-500">({group.nodes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => onSetMany(ids, true)}
                aria-label={`Select all in ${group.phase}`}
                className={linkButton}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onSetMany(ids, false)}
                aria-label={`Select none in ${group.phase}`}
                className={linkButton}
              >
                Select none
              </button>
            </div>

            {!collapsed && (
              <div className="px-3 pb-2">
                {group.nodes.map((node) => (
                  <TaskNode
                    key={node.row.source.task_id}
                    node={node}
                    depth={0}
                    selected={selected}
                    expanded={expanded}
                    onToggleExpanded={(key) => setExpanded((current) => flip(current, key))}
                    onToggleTask={onToggle}
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
