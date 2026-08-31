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

  async function handleClick() {
    setActionError(null);
    const result = await startSync();

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
          onClick={handleClick}
          disabled={isRunning}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-500"
        >
          {isRunning ? "Syncing…" : "Sync Now"}
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
