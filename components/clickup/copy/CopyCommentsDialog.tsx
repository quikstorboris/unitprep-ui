"use client";

import { useMemo, useState } from "react";

import ModalShell from "@/components/shared/ModalShell";
import type { CopyScope } from "@/lib/clickupCopy";
import CopyRow, { COPY_GRID } from "./CopyRow";
import { buildCopyGroups, type CopyNode } from "./copyTree";
import { useCopyComments } from "./useCopyComments";

const selectClass = "rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200";

/** A facility the comments can be copied from. */
export interface CopySource {
  id: string;
  name: string;
}

/**
 * Copy comments from another facility's ClickUp list onto this facility's
 * (see `unitprep-api`'s `clickup_copy`). Rows are the source list's Set Up
 * and Migration tasks, collapsible by phase; each is paired with its
 * counterpart in this facility's list, with the source task's latest
 * comment prefilled for editing. The cursor starts in the first comment
 * box so the person can type straight away.
 */
export default function CopyCommentsDialog({
  companyId,
  facilityId,
  facilityName,
  sources,
  defaultSourceId,
  onClose,
}: {
  companyId: string;
  facilityId: string;
  facilityName: string;
  /** Every other facility with a ClickUp list linked. */
  sources: CopySource[];
  /** The company's parent facility, when it is one of `sources`. */
  defaultSourceId: string | null;
  onClose: () => void;
}) {
  const copy = useCopyComments(companyId, facilityId, defaultSourceId ?? sources[0]?.id ?? null);
  const { pairs, rows } = copy;

  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const groups = useMemo(() => buildCopyGroups(pairs?.rows ?? []), [pairs]);
  const firstKey = groups[0]?.nodes[0]?.row.source.task_id ?? null;

  function togglePhase(phase: string) {
    setCollapsedPhases((current) => {
      const next = new Set(current);
      if (!next.delete(phase)) next.add(phase);
      return next;
    });
  }

  function toggleRow(node: CopyNode) {
    const key = node.row.source.task_id;
    const opening = !expanded.has(key);
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
    // Subtasks' comments are only read once they are on screen.
    if (opening) copy.ensureLoaded(node.children.map((child) => child.row.source.task_id));
  }

  return (
    <ModalShell labelledBy="copy-comments-title" onClose={onClose} width="max-w-6xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="copy-comments-title" className="text-xl font-semibold">
            Copy comments to {facilityName}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Each comment is posted under your name on the matching task in this facility&apos;s list, ending
            with a &quot;Main tracker task&quot; link to the task it was copied from.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200">
          Close
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Copy from
          <select
            value={copy.sourceId ?? ""}
            onChange={(event) => copy.setSourceId(event.target.value || null)}
            className={selectClass}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
                {source.id === defaultSourceId ? " (parent)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          Tasks
          <select
            value={copy.scope}
            onChange={(event) => copy.setScope(event.target.value as CopyScope)}
            className={selectClass}
          >
            <option value="all">All</option>
            <option value="corporate">Corporate only</option>
            <option value="facility">Facility only</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={copy.completeTasks}
            onChange={(event) => copy.setCompleteTasks(event.target.checked)}
          />
          Also mark each task complete
        </label>
      </div>

      {copy.loadError && (
        <p role="alert" className="text-sm text-red-400">
          {copy.loadError}
        </p>
      )}

      {!pairs && !copy.loadError && <p className="text-sm text-slate-400">Loading tasks from ClickUp…</p>}

      {pairs && (
        <>
          {pairs.parent === null && (
            <p className="mb-3 text-xs text-slate-500">
              No parent facility is designated, so no &quot;main task list&quot; note will be added to the
              target tasks.
            </p>
          )}

          {groups.length === 0 && (
            <p className="text-sm text-slate-400">
              No tasks to copy{copy.scope === "all" ? "" : " with this filter"}.
            </p>
          )}

          {groups.length > 0 && (
            <div role="table" aria-label="Comments to copy">
              <div className={`${COPY_GRID} pb-2 text-xs font-medium uppercase tracking-wide text-slate-500`}>
                <span>{pairs.source.facility_name}</span>
                <span>{pairs.target.facility_name}</span>
                <span>Comment</span>
                <span />
              </div>

              {groups.map((group) => {
                const collapsed = collapsedPhases.has(group.phase);
                return (
                  <section key={group.phase}>
                    <button
                      type="button"
                      onClick={() => togglePhase(group.phase)}
                      aria-expanded={!collapsed}
                      className="flex w-full items-center gap-2 border-t border-slate-700 py-2 text-left text-sm font-semibold text-slate-200 hover:bg-slate-800/50"
                    >
                      <span className="w-4 text-slate-400">{collapsed ? "▸" : "▾"}</span>
                      {group.phase}
                      <span className="text-xs font-normal text-slate-500">({group.nodes.length})</span>
                    </button>

                    {!collapsed &&
                      group.nodes.map((node) => (
                        <CopyRow
                          key={node.row.source.task_id}
                          node={node}
                          depth={0}
                          rows={rows}
                          targetTasks={pairs.target_tasks}
                          expanded={expanded}
                          autoFocusKey={firstKey}
                          onToggle={toggleRow}
                          onChooseTarget={copy.chooseTarget}
                          onComment={copy.setComment}
                          onConfirm={(key) => void copy.confirm(key)}
                        />
                      ))}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
