"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { listCopyJobs, type CopyJob } from "@/lib/clickupBulkCopy";

/** How often a running job is checked while the tab is in front. */
export const POLL_MS = 3000;

/** How often it is checked while the tab is hidden (only the finish matters then). */
export const POLL_HIDDEN_MS = 15_000;

/** What the browser notification says about a finished job. */
export function notificationFor(job: CopyJob): { title: string; body: string } {
  const where = `"${job.source_task_name}"`;

  if (job.status === "done") {
    return {
      title: "ClickUp Copy finished",
      body:
        job.failed === 0
          ? `${where} was copied to ${job.copied} ${job.copied === 1 ? "facility" : "facilities"}.`
          : `${where}: ${job.copied} copied, ${job.failed} failed. Open the client to see which.`,
    };
  }
  return {
    title: "ClickUp Copy stopped",
    body:
      job.status === "interrupted"
        ? `${where} was interrupted after ${job.copied + job.failed} of ${job.total}. Check ClickUp, then copy the rest again.`
        : `${where} failed${job.message ? `: ${job.message}` : "."}`,
  };
}

/** Tells the person with a browser notification, when they allowed them.
 * Never throws: notifications are a courtesy, not part of the copy. */
function notify(job: CopyJob) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const { title, body } = notificationFor(job);
    new Notification(title, { body });
  } catch {
    // Some browsers refuse to construct a Notification outside a service worker.
  }
}

/** Asks the browser for notification permission. Must be called from a
 * click handler (browsers ignore it otherwise). Resolves quietly whatever
 * the person answers. */
export async function askForNotifications(): Promise<void> {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    // Not available here; the on-page banner still tells them.
  }
}

/**
 * The signed-in user's recent copy jobs for a client, kept current while
 * any is running. A job seen going from running to finished (in this
 * session -- not one that was already finished when the page loaded)
 * raises a browser notification, so the person can leave the tab while a
 * big copy works through ClickUp's rate limit.
 */
export function useCopyJobs(companyId: string) {
  const [jobs, setJobs] = useState<CopyJob[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Ids seen running, so only a transition raises a notification.
  const seenRunning = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const result = await listCopyJobs(companyId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);

    for (const job of result.data) {
      if (job.status === "running") {
        seenRunning.current.add(job.id);
      } else if (seenRunning.current.delete(job.id)) {
        notify(job);
      }
    }
    setJobs(result.data);
  }, [companyId]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  const anyRunning = jobs.some((job) => job.status === "running");
  useEffect(() => {
    if (!anyRunning) return;

    // Not paused in a hidden tab -- the whole point is that the person can
    // leave while a big copy runs and still get the "finished" notification
    // -- but slowed right down: nobody is looking at the progress, so one
    // check every POLL_HIDDEN_MS is plenty to notice the end.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        void refresh();
        schedule();
      }, document.hidden ? POLL_HIDDEN_MS : POLL_MS);
    };
    schedule();

    // Coming back to the tab: catch up at once instead of waiting out a
    // slow hidden-tab interval.
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [anyRunning, refresh]);

  return { jobs, loadError, refresh };
}
