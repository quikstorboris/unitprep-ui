"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  bulkCopy,
  getBulkComment,
  getBulkPairs,
  getBulkTasks,
  type BulkCopyResult,
  type BulkPairs,
  type BulkTask,
  type BulkTasks,
} from "@/lib/clickupBulkCopy";
import type { CopyScope } from "@/lib/clickupCopy";
import { askForNotifications } from "./useCopyJobs";

/** What the person has set for one chosen source task. */
export interface TaskCopyState {
  /** The task's counterpart in each destination, once read. */
  pairs: BulkPairs | null;
  pairsError: string | null;
  /** The task the comment goes on in each facility; null = none (that
   * facility is skipped for this task). */
  targets: Record<string, string | null>;
  /** The comment as it will be posted -- prefilled, then the person's. */
  comment: string;
  /** The person has typed: a late-arriving prefill must not replace it. */
  edited: boolean;
  commentLoading: boolean;
  /** The source task has no comment to prefill. */
  noSourceComment: boolean;
}

/** What happened to one source task's copy. */
export interface TaskOutcome {
  taskId: string;
  taskName: string;
  /** Null when the request itself failed (see `error`). */
  result: BulkCopyResult | null;
  error: string | null;
}

/** ClickUp calls a destination can cost (its comment, reading the task's
 * comments for the pointer, posting the pointer -- and, when completing,
 * reading the list's statuses and setting the status), and the most the
 * server will do inside one request. Mirrors `clickup_copy::exec`. The
 * whole selection is added up: a copy of several tasks that is too big
 * for ClickUp's rate limit as a whole is sent to the background, one job
 * per task, and the browser's notification permission is asked for while
 * the click is still fresh. */
const CALLS_PER_DESTINATION = 3;
const EXTRA_CALLS_WHEN_COMPLETING = 2;
const INLINE_CALL_BUDGET = 50;

const emptyTask = (): TaskCopyState => ({
  pairs: null,
  pairsError: null,
  targets: {},
  comment: "",
  edited: false,
  commentLoading: true,
  noSourceComment: false,
});

/**
 * State and actions behind the client's ClickUp Copy tab: the source
 * facility's tasks, any number of them chosen (each with its own comment
 * and counterparts), the facilities to copy to (one choice for all the
 * tasks), and the copy itself -- one request per task, so each task keeps
 * its own comment and its own "Main tracker task" link. `onJobStarted`
 * lets the page refresh its job list when a copy moves to the background.
 */
export function useBulkCopy(
  companyId: string,
  initialSourceId: string | null,
  onJobStarted: () => void
) {
  const [sourceId, setSourceId] = useState<string | null>(initialSourceId);
  const [scope, setScope] = useState<CopyScope>("all");

  const [tasks, setTasks] = useState<BulkTasks | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [perTask, setPerTask] = useState<Record<string, TaskCopyState>>({});
  // Facilities chosen as destinations. Nothing is chosen until ticked.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  // Off unless the person asks: copying only comments is the normal case.
  const [completeTasks, setCompleteTasks] = useState(false);

  const [copying, setCopying] = useState(false);
  const [outcomes, setOutcomes] = useState<TaskOutcome[] | null>(null);

  // Answers that arrive after the source or filter changed are stale.
  const generation = useRef(0);
  // Task lookups run one task at a time: each reads every destination's
  // list, and ClickUp allows about 100 requests a minute.
  const queue = useRef<Promise<void>>(Promise.resolve());

  function resetSelection() {
    generation.current += 1;
    setSelectedIds([]);
    setPerTask({});
    setTicked({});
    setOutcomes(null);
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setTasks(null);
      setLoadError(null);
      resetSelection();

      const response = await getBulkTasks(companyId, { sourceFacilityId: sourceId, scope });
      if (cancelled) return;

      if (response.kind !== "ok") {
        setLoadError(response.message);
        return;
      }
      setTasks(response.data);
    });

    return () => {
      cancelled = true;
    };
  }, [companyId, sourceId, scope]);

  /** Reads one chosen task's counterparts and latest comment (the prefill)
   * together, after the tasks chosen before it. */
  function enqueueLoad(taskId: string) {
    const current = generation.current;
    queue.current = queue.current.then(async () => {
      if (current !== generation.current) return;

      const [pairsResponse, commentResponse] = await Promise.all([
        getBulkPairs(companyId, taskId, { sourceFacilityId: sourceId, scope }),
        getBulkComment(companyId, taskId, sourceId),
      ]);
      if (current !== generation.current) return;

      setPerTask((all) => {
        const state = all[taskId];
        // Unchosen again while it loaded.
        if (!state) return all;

        const next: TaskCopyState = { ...state, commentLoading: false };

        if (pairsResponse.kind !== "ok") {
          next.pairsError = pairsResponse.message;
        } else {
          next.pairs = pairsResponse.data;
          next.targets = Object.fromEntries(
            pairsResponse.data.destinations.map((destination) => [
              destination.facility_id,
              destination.target?.task_id ?? null,
            ])
          );
        }

        if (commentResponse.kind === "ok") {
          next.noSourceComment = commentResponse.data.source_comment === null;
          if (!state.edited) next.comment = commentResponse.data.source_comment?.text ?? "";
        }

        return { ...all, [taskId]: next };
      });
    });
  }

  /** Chooses or unchooses source tasks. Several at once (a phase's
   * "Select all") keep the order they are listed in. */
  function setTasksSelected(taskIds: string[], selected: boolean) {
    setOutcomes(null);

    if (!selected) {
      const drop = new Set(taskIds);
      setSelectedIds((current) => current.filter((id) => !drop.has(id)));
      setPerTask((all) => Object.fromEntries(Object.entries(all).filter(([id]) => !drop.has(id))));
      return;
    }

    const fresh = taskIds.filter((id) => !selectedIds.includes(id));
    if (fresh.length === 0) return;

    setSelectedIds((current) => [...current, ...fresh]);
    setPerTask((all) => ({
      ...all,
      ...Object.fromEntries(fresh.map((id) => [id, emptyTask()])),
    }));
    for (const id of fresh) enqueueLoad(id);
  }

  function toggleTask(taskId: string) {
    setTasksSelected([taskId], !selectedIds.includes(taskId));
  }

  function patchTask(taskId: string, change: (state: TaskCopyState) => TaskCopyState) {
    setPerTask((all) => (all[taskId] ? { ...all, [taskId]: change(all[taskId]) } : all));
  }

  /** Facilities whose ClickUp list could not be read for some chosen task:
   * they cannot be chosen, with the reason. */
  const blocked = useMemo(() => {
    const reasons: Record<string, string> = {};
    for (const state of Object.values(perTask)) {
      for (const destination of state.pairs?.destinations ?? []) {
        if (destination.error) reasons[destination.facility_id] = destination.error;
      }
    }
    return reasons;
  }, [perTask]);

  function toggleFacility(facilityId: string) {
    // A facility whose list could not be read cannot be chosen.
    if (blocked[facilityId]) return;
    setTicked((current) => ({ ...current, [facilityId]: !current[facilityId] }));
  }

  function setAllFacilities(checked: boolean) {
    setTicked(
      Object.fromEntries(
        (tasks?.destinations ?? []).map((facility) => [
          facility.facility_id,
          checked && !blocked[facility.facility_id],
        ])
      )
    );
  }

  function chooseTarget(taskId: string, facilityId: string, targetTaskId: string | null) {
    patchTask(taskId, (state) => ({
      ...state,
      targets: { ...state.targets, [facilityId]: targetTaskId },
    }));
  }

  function editComment(taskId: string, text: string) {
    patchTask(taskId, (state) => ({ ...state, comment: text, edited: true }));
  }

  const selectedTasks: BulkTask[] = useMemo(() => {
    const byId = new Map((tasks?.tasks ?? []).map((task) => [task.task_id, task]));
    return selectedIds.flatMap((id) => {
      const task = byId.get(id);
      return task ? [task] : [];
    });
  }, [tasks, selectedIds]);

  /** What will be posted: for each chosen task, the ticked facilities that
   * have a task chosen. A ticked facility with none is skipped for that
   * task, and counted so the page can say so. */
  const plan = useMemo(() => {
    const entries = selectedTasks.map((task) => {
      const state = perTask[task.task_id];
      const destinations: { facility_id: string; target_task_id: string }[] = [];
      let skipped = 0;
      for (const destination of state?.pairs?.destinations ?? []) {
        if (!ticked[destination.facility_id] || blocked[destination.facility_id]) continue;
        const target = state.targets[destination.facility_id] ?? null;
        if (target === null) skipped += 1;
        else destinations.push({ facility_id: destination.facility_id, target_task_id: target });
      }
      return { task, destinations, skipped };
    });

    const withCopies = entries.filter((entry) => entry.destinations.length > 0);
    return {
      entries: withCopies,
      skipped: entries.reduce((sum, entry) => sum + entry.skipped, 0),
      comments: withCopies.reduce((sum, entry) => sum + entry.destinations.length, 0),
      facilities: new Set(withCopies.flatMap((e) => e.destinations.map((d) => d.facility_id))).size,
    };
  }, [selectedTasks, perTask, ticked, blocked]);

  const ready =
    selectedTasks.length > 0 &&
    selectedTasks.every((task) => {
      const state = perTask[task.task_id];
      return state?.pairs !== null && state?.pairs !== undefined && state.comment.trim() !== "";
    });
  const canSubmit = !copying && ready && plan.comments > 0;

  async function submit() {
    if (!canSubmit) return;

    // A copy this big runs in the background and ends with a notification,
    // which the browser only lets a click ask permission for.
    const callsPerDestination = CALLS_PER_DESTINATION + (completeTasks ? EXTRA_CALLS_WHEN_COMPLETING : 0);
    const background = plan.comments * callsPerDestination > INLINE_CALL_BUDGET;
    if (background) await askForNotifications();

    setCopying(true);
    setOutcomes([]);

    // One task at a time: each has its own comment and source link, and
    // ClickUp's rate limit is shared by all of them.
    const done: TaskOutcome[] = [];
    let jobStarted = false;
    for (const { task, destinations } of plan.entries) {
      const response = await bulkCopy(companyId, {
        sourceFacilityId: sourceId,
        sourceTaskId: task.task_id,
        sourceTaskName: task.name,
        comment: perTask[task.task_id].comment,
        destinations,
        completeTasks,
        background,
      });

      done.push(
        response.kind === "ok"
          ? { taskId: task.task_id, taskName: task.name, result: response.data, error: null }
          : { taskId: task.task_id, taskName: task.name, result: null, error: response.message }
      );
      if (response.kind === "ok" && response.data.mode === "job") jobStarted = true;
      setOutcomes([...done]);
    }

    setCopying(false);
    if (jobStarted) onJobStarted();
  }

  return {
    sourceId,
    setSourceId,
    scope,
    setScope,
    tasks,
    loadError,
    selectedIds,
    selectedTasks,
    perTask,
    toggleTask,
    setTasksSelected,
    ticked,
    blocked,
    toggleFacility,
    setAllFacilities,
    chooseTarget,
    editComment,
    completeTasks,
    setCompleteTasks,
    plan,
    canSubmit,
    copying,
    outcomes,
    submit,
  };
}
