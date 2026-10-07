"use client";

import { useEffect, useRef, useState } from "react";

import {
  bulkCopy,
  getBulkComment,
  getBulkPairs,
  getBulkTasks,
  type BulkCopyResult,
  type BulkPairs,
  type BulkTasks,
} from "@/lib/clickupBulkCopy";
import type { CopyScope } from "@/lib/clickupCopy";
import { askForNotifications } from "./useCopyJobs";

/** One destination as the person has set it. */
export interface DestinationState {
  /** The task the comment will be posted on; null = none yet. */
  targetTaskId: string | null;
  /** Chosen as a destination. Nothing is chosen until the person ticks it. */
  checked: boolean;
  /** This facility's list could not be read, so it cannot be chosen. */
  blocked: boolean;
}

/** ClickUp calls a destination can cost (its comment, reading the task's
 * comments for the pointer, posting the pointer), and the most the server
 * will do inside one request. Mirrors `clickup_copy::exec` -- used only to
 * ask for notification permission while the click is still fresh; the
 * server decides whether the copy actually runs in the background. */
const CALLS_PER_DESTINATION = 3;
const INLINE_CALL_BUDGET = 50;

/**
 * State and actions behind the client's ClickUp Copy tab: the source
 * facility's tasks, the one chosen, each destination's suggested
 * counterpart and checkbox, the shared comment, and the copy itself.
 * `onJobStarted` lets the page refresh its job list when a big copy
 * moves to the background.
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

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pairs, setPairs] = useState<BulkPairs | null>(null);
  const [pairsError, setPairsError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Record<string, DestinationState>>({});
  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [noSourceComment, setNoSourceComment] = useState(false);

  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkCopyResult | null>(null);

  // The person has typed: a late-arriving prefill must not replace it.
  const edited = useRef(false);
  // Answers that arrive after the task or source changed are stale.
  const generation = useRef(0);

  function resetSelection() {
    generation.current += 1;
    edited.current = false;
    setSelectedTaskId(null);
    setPairs(null);
    setPairsError(null);
    setDestinations({});
    setComment("");
    setNoSourceComment(false);
    setResult(null);
    setCopyError(null);
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

  /** Chooses the source task: reads each destination's counterpart and the
   * task's latest comment (the prefill) together. */
  async function chooseTask(taskId: string) {
    const current = ++generation.current;
    edited.current = false;
    setSelectedTaskId(taskId);
    setPairs(null);
    setPairsError(null);
    setDestinations({});
    setComment("");
    setNoSourceComment(false);
    setCommentLoading(true);
    setResult(null);
    setCopyError(null);

    const [pairsResponse, commentResponse] = await Promise.all([
      getBulkPairs(companyId, taskId, { sourceFacilityId: sourceId, scope }),
      getBulkComment(companyId, taskId, sourceId),
    ]);
    if (current !== generation.current) return;

    setCommentLoading(false);

    if (pairsResponse.kind !== "ok") {
      setPairsError(pairsResponse.message);
    } else {
      setPairs(pairsResponse.data);
      // Nothing starts selected: where a comment goes is the person's call.
      const initial: Record<string, DestinationState> = {};
      for (const destination of pairsResponse.data.destinations) {
        initial[destination.facility_id] = {
          targetTaskId: destination.target?.task_id ?? null,
          checked: false,
          blocked: Boolean(destination.error),
        };
      }
      setDestinations(initial);
    }

    if (commentResponse.kind === "ok") {
      const text = commentResponse.data.source_comment?.text ?? "";
      setNoSourceComment(commentResponse.data.source_comment === null);
      if (!edited.current) setComment(text);
    }
  }

  function toggle(facilityId: string) {
    setDestinations((current) => {
      const destination = current[facilityId];
      // A facility whose list could not be read cannot be chosen.
      if (!destination || destination.blocked) return current;
      return { ...current, [facilityId]: { ...destination, checked: !destination.checked } };
    });
  }

  function setAll(checked: boolean) {
    setDestinations((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, destination]) => [
          id,
          { ...destination, checked: checked && !destination.blocked },
        ])
      )
    );
  }

  function chooseTarget(facilityId: string, targetTaskId: string | null) {
    setDestinations((current) => {
      const destination = current[facilityId];
      if (!destination) return current;
      return { ...current, [facilityId]: { ...destination, targetTaskId } };
    });
  }

  function editComment(text: string) {
    edited.current = true;
    setComment(text);
  }

  const ticked = Object.values(destinations).filter((destination) => destination.checked);
  const chosen = Object.entries(destinations).filter(
    ([, destination]) => destination.checked && destination.targetTaskId !== null
  );
  // Ticked facilities that still need a task picked before the copy can go.
  const missingTargets = ticked.length - chosen.length;
  const selectedTask = tasks?.tasks.find((task) => task.task_id === selectedTaskId) ?? null;
  const canSubmit =
    !copying &&
    selectedTask !== null &&
    comment.trim() !== "" &&
    chosen.length > 0 &&
    missingTargets === 0;

  async function submit() {
    if (!canSubmit || !selectedTask) return;

    // A copy this big runs in the background and ends with a notification,
    // which the browser only lets a click ask permission for.
    if (chosen.length * CALLS_PER_DESTINATION > INLINE_CALL_BUDGET) {
      await askForNotifications();
    }

    setCopying(true);
    setCopyError(null);
    setResult(null);
    const response = await bulkCopy(companyId, {
      sourceFacilityId: sourceId,
      sourceTaskId: selectedTask.task_id,
      sourceTaskName: selectedTask.name,
      comment,
      destinations: chosen.map(([facilityId, destination]) => ({
        facility_id: facilityId,
        target_task_id: destination.targetTaskId as string,
      })),
    });
    setCopying(false);

    if (response.kind !== "ok") {
      setCopyError(response.message);
      return;
    }

    setResult(response.data);
    if (response.data.mode === "job") onJobStarted();
  }

  return {
    sourceId,
    setSourceId,
    scope,
    setScope,
    tasks,
    loadError,
    selectedTaskId,
    selectedTask,
    chooseTask,
    pairs,
    pairsError,
    destinations,
    toggle,
    setAll,
    chooseTarget,
    comment,
    editComment,
    commentLoading,
    noSourceComment,
    chosenCount: chosen.length,
    missingTargets,
    canSubmit,
    copying,
    copyError,
    result,
    submit,
  };
}
