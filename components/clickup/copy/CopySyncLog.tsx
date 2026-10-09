"use client";

import { useCallback, useEffect, useState } from "react";

import { getSyncLog, type SyncLogEntry } from "@/lib/clickupCopy";
import { formatDateTime } from "@/lib/format";

/** What one logged copy did, in a line: "3 comments copied, 1 failed". */
function describe(entry: SyncLogEntry): string {
  const parts = [`${entry.copied} ${entry.copied === 1 ? "comment" : "comments"} copied`];
  if (entry.failed > 0) parts.push(`${entry.failed} failed`);
  if (entry.tasks_completed > 0) {
    parts.push(`${entry.tasks_completed} ${entry.tasks_completed === 1 ? "task" : "tasks"} completed`);
  }
  return parts.join(", ");
}

/**
 * The facility's "Last Synced Project": which project (facility) comments
 * were last copied from onto this facility's ClickUp tasks, with a
 * scrollable, newest-first history underneath. Read from the Activity
 * Logs trail (the API keeps no second log). `refreshKey` reloads it --
 * the host bumps it when the Copy dialog closes.
 */
export default function CopySyncLog({
  companyId,
  facilityId,
  refreshKey,
}: {
  companyId: string;
  facilityId: string;
  refreshKey: number;
}) {
  const [entries, setEntries] = useState<SyncLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSyncLog(companyId, facilityId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.kind !== "ok") {
        setError(result.message);
        return;
      }
      setError(null);
      setEntries(result.data.entries);
      setHasMore(result.data.has_more);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, facilityId, refreshKey]);

  const loadOlder = useCallback(async () => {
    const last = entries[entries.length - 1];
    if (!last) return;
    setLoading(true);
    const result = await getSyncLog(companyId, facilityId, last.id);
    setLoading(false);
    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }
    setEntries((current) => [...current, ...result.data.entries]);
    setHasMore(result.data.has_more);
  }, [companyId, facilityId, entries]);

  const latest = entries[0];

  return (
    <div className="mt-4 border-t border-slate-800 pt-4" aria-label="Last Synced Project">
      <h3 className="text-sm font-semibold text-slate-200">Last Synced Project</h3>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {!error && !latest && (
        <p className="mt-2 text-sm text-slate-500">
          {loading ? "Loading…" : "No comments have been copied onto this facility yet."}
        </p>
      )}

      {latest && (
        <>
          <p className="mt-2 text-sm text-slate-300">
            {latest.source_facility_name ?? "A removed facility"}
            <span className="text-slate-500"> · {formatDateTime(latest.created_at)}</span>
          </p>

          <ul className="mt-3 max-h-48 divide-y divide-slate-800 overflow-y-auto rounded border border-slate-800 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="px-3 py-2">
                <div className="text-slate-200">
                  {entry.source_facility_name ?? "A removed facility"}
                  <span className="text-slate-500">
                    {" "}
                    · {formatDateTime(entry.created_at)}
                    {entry.actor_name ? ` · ${entry.actor_name}` : ""}
                    {entry.bulk ? " · from the client tab" : ""}
                  </span>
                </div>
                <div className={entry.failed > 0 ? "text-amber-300" : "text-slate-400"}>{describe(entry)}</div>
              </li>
            ))}
          </ul>

          {hasMore && (
            <button
              type="button"
              onClick={loadOlder}
              disabled={loading}
              className="mt-2 text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline disabled:opacity-50"
            >
              {loading ? "Loading…" : "Show older"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
