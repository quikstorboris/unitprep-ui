"use client";

import type { CopyJob } from "@/lib/clickupBulkCopy";
import CopyResults from "./CopyResults";

function summary(job: CopyJob): { text: string; tone: string } {
  const done = job.copied + job.failed;

  switch (job.status) {
    case "running":
      return { text: `Copying — ${done} of ${job.total} done…`, tone: "text-blue-300" };
    case "done":
      return job.failed === 0
        ? { text: `Copied to ${job.copied} ${job.copied === 1 ? "facility" : "facilities"}.`, tone: "text-green-400" }
        : { text: `${job.copied} copied, ${job.failed} failed.`, tone: "text-amber-300" };
    case "interrupted":
      return {
        text: `Interrupted after ${done} of ${job.total}. Check ClickUp, then copy the rest again.`,
        tone: "text-amber-300",
      };
    default:
      return { text: `Failed${job.message ? `: ${job.message}` : "."}`, tone: "text-red-400" };
  }
}

/**
 * The person's recent big copies for this client. A copy too large for one
 * request runs in the background, paced to ClickUp's rate limit; this is
 * where its progress and outcome show, and the page tells them with a
 * browser notification when one finishes.
 */
export default function CopyJobsList({ jobs }: { jobs: CopyJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <section aria-label="Recent copies" className="rounded border border-slate-800 p-4">
      <h2 className="mb-2 text-sm font-semibold text-slate-200">Recent copies</h2>
      <ul className="space-y-2">
        {jobs.map((job) => {
          const { text, tone } = summary(job);
          return (
            <li key={job.id} className="text-sm">
              <div>
                <span className="text-slate-200">“{job.source_task_name}”</span>{" "}
                <span className="text-xs text-slate-500">{new Date(job.created_at).toLocaleString()}</span>
              </div>
              <div className={tone}>{text}</div>
              {job.status === "running" && (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={job.total}
                  aria-valuenow={job.copied + job.failed}
                  className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800"
                >
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${((job.copied + job.failed) / job.total) * 100}%` }}
                  />
                </div>
              )}
              {job.status !== "running" && job.results.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                    Details
                  </summary>
                  <div className="mt-2">
                    <CopyResults results={job.results} />
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
