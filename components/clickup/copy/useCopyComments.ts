"use client";

import { useEffect, useRef, useState } from "react";

import {
  copyComments,
  getCopyComments,
  getCopyPairs,
  type CopyPairs,
  type CopyPointerOutcome,
  type CopyScope,
} from "@/lib/clickupCopy";
import { buildCopyGroups } from "./copyTree";

/** Everything the dialog needs to show and act on one row, keyed by the
 * source task's id. */
export interface RowState {
  /** The target task this row's comment will be posted on; null = none. */
  targetTaskId: string | null;
  /** The comment as it will be posted -- prefilled, then the person's. */
  comment: string;
  /** The person has typed: a late-arriving prefill must not replace it. */
  edited: boolean;
  loadState: "idle" | "loading" | "ready" | "error";
  /** The source task has no comment to prefill. */
  noSourceComment: boolean;
  /** The target already has a comment reading the same (still allowed). */
  alreadyCopied: boolean;
  copyState: "idle" | "copying" | "copied" | "failed";
  /** Why a load or the copy failed. */
  message: string | null;
  /** What happened to the main-list note, after a copy. */
  pointer: CopyPointerOutcome | null;
}

/** Comment lookups in flight at once. Each is two ClickUp reads, and
 * ClickUp allows about 100 requests a minute, so this stays small. */
const LOAD_CONCURRENCY = 3;

const BLANK_ROW: RowState = {
  targetTaskId: null,
  comment: "",
  edited: false,
  loadState: "idle",
  noSourceComment: false,
  alreadyCopied: false,
  copyState: "idle",
  message: null,
  pointer: null,
};

async function runPool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++]);
  });
  await Promise.all(workers);
}

/**
 * State and actions behind the ClickUp Copy dialog on the facility being
 * copied *to*. Loads the paired tasks once per (source, scope); the
 * comment lookups behind each row (the prefill and the "looks already
 * copied" check) are lazy -- only for rows on screen, a few at a time --
 * because every one is real ClickUp traffic.
 */
export function useCopyComments(companyId: string, facilityId: string, initialSourceId: string | null) {
  const [sourceId, setSourceId] = useState<string | null>(initialSourceId);
  const [scope, setScope] = useState<CopyScope>("all");
  const [pairs, setPairs] = useState<CopyPairs | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});

  // Answers that arrive after the source or scope changed are stale.
  const generation = useRef(0);
  const rowsRef = useRef(rows);
  const pairsRef = useRef(pairs);
  useEffect(() => {
    rowsRef.current = rows;
    pairsRef.current = pairs;
  });

  function patch(key: string, change: Partial<RowState> | ((row: RowState) => Partial<RowState>)) {
    setRows((current) => {
      const row = current[key] ?? BLANK_ROW;
      return { ...current, [key]: { ...row, ...(typeof change === "function" ? change(row) : change) } };
    });
  }

  async function loadOne(key: string, current: number) {
    const targetTaskId = rowsRef.current[key]?.targetTaskId;
    if (!targetTaskId) {
      patch(key, { loadState: "ready" });
      return;
    }

    patch(key, { loadState: "loading", message: null });
    const result = await getCopyComments(companyId, facilityId, key, targetTaskId, sourceId);
    if (current !== generation.current) return;

    if (result.kind !== "ok") {
      patch(key, { loadState: "error", message: result.message });
      return;
    }
    const { source_comment, already_copied } = result.data;
    patch(key, (row) => ({
      loadState: "ready",
      comment: row.edited ? row.comment : (source_comment?.text ?? ""),
      noSourceComment: source_comment === null,
      alreadyCopied: already_copied,
    }));
  }

  /** Starts the comment lookups for rows not loaded yet. */
  function ensureLoaded(keys: string[]) {
    const current = generation.current;
    const pending = keys.filter((key) => (rowsRef.current[key]?.loadState ?? "idle") === "idle");
    // Mark them all now, so a quick second call does not queue them twice.
    for (const key of pending) patch(key, { loadState: "loading" });
    void runPool(pending, LOAD_CONCURRENCY, (key) => loadOne(key, current));
  }

  useEffect(() => {
    const current = ++generation.current;
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setPairs(null);
      setLoadError(null);
      setRows({});

      const result = await getCopyPairs(companyId, facilityId, { sourceFacilityId: sourceId, scope });
      if (cancelled || current !== generation.current) return;

      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }

      const initial: Record<string, RowState> = {};
      for (const row of result.data.rows) {
        initial[row.source.task_id] = { ...BLANK_ROW, targetTaskId: row.target?.task_id ?? null };
      }
      rowsRef.current = initial;
      setRows(initial);
      setPairs(result.data);

      // Only the top-level (mid-level) rows are visible at first.
      const topLevel = buildCopyGroups(result.data.rows).flatMap((group) =>
        group.nodes.map((node) => node.row.source.task_id)
      );
      void runPool(topLevel, LOAD_CONCURRENCY, (key) => loadOne(key, current));
    });

    return () => {
      cancelled = true;
    };
    // loadOne reads everything else through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, facilityId, sourceId, scope]);

  function chooseTarget(key: string, targetTaskId: string | null) {
    patch(key, {
      targetTaskId,
      loadState: "idle",
      alreadyCopied: false,
      copyState: "idle",
      message: null,
      pointer: null,
    });
    rowsRef.current = { ...rowsRef.current, [key]: { ...rowsRef.current[key], targetTaskId, loadState: "idle" } };
    if (targetTaskId) void loadOne(key, generation.current);
  }

  function setComment(key: string, comment: string) {
    patch(key, (row) => ({
      comment,
      edited: true,
      // Editing a row that failed or was copied makes it ready again.
      copyState: row.copyState === "copying" ? row.copyState : "idle",
    }));
  }

  async function confirm(key: string) {
    const row = rowsRef.current[key];
    if (!row?.targetTaskId || !row.comment.trim() || row.copyState === "copying") return;

    patch(key, { copyState: "copying", message: null, pointer: null });
    const result = await copyComments(
      companyId,
      facilityId,
      [{ target_task_id: row.targetTaskId, comment: row.comment }],
      sourceId
    );

    if (result.kind !== "ok") {
      patch(key, { copyState: "failed", message: result.message });
      return;
    }

    const outcome = result.data.results[0];
    patch(key, {
      copyState: outcome.comment.ok ? "copied" : "failed",
      message: outcome.comment.message,
      pointer: outcome.pointer,
      // What was just posted now reads as already there.
      alreadyCopied: outcome.comment.ok,
    });
  }

  return {
    sourceId,
    setSourceId,
    scope,
    setScope,
    pairs,
    loadError,
    rows,
    ensureLoaded,
    chooseTarget,
    setComment,
    confirm,
  };
}
