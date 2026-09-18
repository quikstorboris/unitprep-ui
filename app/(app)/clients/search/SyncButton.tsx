"use client";

import { useEffect, useRef, useState } from "react";

import { getSyncStatus, startSync, type SyncStatus } from "@/lib/clientsSearch";

const POLL_INTERVAL_MS = 1500;

/**
 * "Sync Now" for the Process Street person-index (`clients.ps_person_index`)
 * -- triggers `clients::sync::run_all_workflows_with_progress` on demand
 * instead of waiting for the nightly background pass, and polls
 * `/clients/sync/status` for a live percentage while it runs. Shares the
 * backend's `sync_progress` handle with that nightly task, so this also
 * picks up and displays a scheduled sync's progress if one happens to be
 * running when this page loads -- not just syncs this button itself
 * started.
 *
 * "Force Full Resync" is the same trigger with `?force=true` -- it
 * bypasses the delta check so every run gets re-fetched, not just the
 * ones PS itself says changed. Confirmed via a native dialog rather than
 * a second undifferentiated button, since it costs real shared PS API
 * budget.
 */
export default function SyncButton() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollOnce() {
    const result = await getSyncStatus();
    if (result.kind !== "ok") {
      // A transient fetch error while polling shouldn't blow away the
      // last-known progress -- just stop polling silently and let the
      // user retry with the button.
      stopPolling();
      return;
    }

    setStatus(result.data);
    if (result.data.state !== "running") {
      stopPolling();
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    // Picks up a sync already in progress (the nightly task, or another
    // browser tab's manual trigger) as soon as this page loads, not just
    // ones this button itself starts.
    queueMicrotask(async () => {
      await pollOnce();
    });

    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status?.state === "running" && pollRef.current === null) {
      startPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.state]);

  async function handleClick(force: boolean) {
    if (force) {
      // A full resync re-fetches every run in every workflow from PS
      // regardless of what actually changed -- real, shared API budget
      // (see startSync's own doc comment) -- so this stays a deliberate,
      // confirmed action rather than a second one-click button sitting
      // next to the cheap default.
      const confirmed = window.confirm(
        "This re-syncs every Process Street run from scratch instead of just what changed, " +
          "which uses a lot more of PS's shared API rate limit. Only do this if you specifically " +
          "need to backfill or refresh data the normal sync wouldn't touch. Continue?",
      );
      if (!confirmed) {
        return;
      }
    }

    setActionError(null);
    const result = await startSync(force);

    if (result.kind !== "ok") {
      // A 409 ("already running") lands here too -- either way,
      // something is running now, so check status immediately rather
      // than just showing the error and leaving the user unsure.
      setActionError(result.kind === "error" ? result.message : null);
    }

    await pollOnce();
  }

  const isRunning = status?.state === "running";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => handleClick(false)}
          disabled={isRunning}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {isRunning ? "Syncing…" : "Sync Now"}
        </button>

        <button
          type="button"
          onClick={() => handleClick(true)}
          disabled={isRunning}
          title="Re-syncs every run from scratch instead of just what changed -- uses much more of Process Street's shared API rate limit."
          className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200 disabled:cursor-not-allowed disabled:text-slate-600"
        >
          Force Full Resync…
        </button>

        {status && (
          <span className="text-sm text-slate-400">{statusLabel(status)}</span>
        )}
      </div>

      {status && (isRunning || status.state === "completed") && status.total_runs > 0 && (
        <div className="h-2 w-full max-w-md overflow-hidden rounded bg-slate-800">
          <div
            className={`h-full transition-[width] duration-300 ${
              status.state === "completed" ? "bg-green-600" : "bg-blue-600"
            }`}
            style={{ width: `${status.percent}%` }}
          />
        </div>
      )}

      {status?.state === "failed" && status.error && (
        <p role="alert" className="text-sm text-red-400">
          Sync failed: {status.error}
        </p>
      )}

      {actionError && (
        <p role="alert" className="text-sm text-amber-400">
          {actionError}
        </p>
      )}
    </div>
  );
}

function statusLabel(status: SyncStatus): string {
  switch (status.state) {
    case "idle":
      return "No sync has run yet this session.";
    case "running":
      return `${status.percent}% (${status.processed_runs}/${status.total_runs} runs)`;
    case "completed":
      return `Sync complete — ${status.processed_runs}/${status.total_runs} runs checked.`;
    case "failed":
      return "Last sync failed.";
  }
}
