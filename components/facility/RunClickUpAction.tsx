"use client";

import { useClickUpAccess } from "@/components/clickup/useClickUpAccess";
import type { ToolRunSummary } from "@/types/api";

/** Whether a run has a ClickUp task Orchestrator knows how to update.
 *
 * Every tool does: which task (its name phrases) and what the comment says
 * are rows of `integrations.clickup_task_steps` on the server, so adding
 * or renaming one is a data edit, not a change here. A tool added to
 * `ToolRunSummary` without a step row gets the server's "no ClickUp task
 * is configured" message in the panel. */
export function canUpdateClickUp(run: ToolRunSummary): boolean {
  return run.tool === "dedup" || run.tool === "unit_group" || run.tool === "tagger";
}

/**
 * "Update ClickUp" on a recorded run: a manual way to post the run's
 * result to its ClickUp task afterwards, for when that was skipped (or
 * ClickUp was unavailable) when the tool ran. Toggles the panel the
 * host renders; the panel finds the task, lets the person confirm it, and
 * does the same comment/assignee/status update as right after a check.
 *
 * Hidden for users without the per-user ClickUp permission.
 */
export function RunClickUpAction({
  run,
  open,
  onToggle,
}: {
  run: ToolRunSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const access = useClickUpAccess();

  if (!access.allowed || !canUpdateClickUp(run)) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
    >
      Update ClickUp
    </button>
  );
}
