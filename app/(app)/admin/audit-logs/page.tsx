"use client";

import { useCallback, useEffect, useState } from "react";

import RequireAdmin from "@/components/auth/RequireAdmin";
import { listAuditLogs, type AuditLogEntry } from "@/lib/auth";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const PAGE_SIZE = 50;

/**
 * Before/after diffing for the change-type events (`user_deactivated`,
 * `account_recovery_initiated`, and any future `role_changed`/
 * `auth_configuration_updated`) -- red for what a field held, green for
 * what it holds now. Most events carry neither and this renders nothing
 * for them, which is deliberate: an occurrence is not a transition.
 */
function ChangeDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) return null;

  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  );

  return (
    <dl className="flex flex-col gap-0.5">
      {keys.map((key) => {
        const beforeValue = before?.[key];
        const afterValue = after?.[key];

        return (
          <div key={key} className="flex gap-2">
            <dt className="text-slate-500">{key}:</dt>
            <dd>
              {before && (
                <span className="text-red-400 line-through">
                  {String(beforeValue)}
                </span>
              )}
              {before && after && (
                <span className="mx-1 text-slate-600">→</span>
              )}
              {after && (
                <span className="text-green-400">{String(afterValue)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function hasContent(value: Record<string, unknown> | null): boolean {
  return value !== null && Object.keys(value).length > 0;
}

export default function AdminAuditLogsPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");

  const runQuery = useCallback(
    async (beforeId?: number) => {
      const result = await listAuditLogs({
        limit: PAGE_SIZE,
        beforeId,
        eventType: eventTypeFilter.trim() || undefined,
        userId: userIdFilter.trim() || undefined,
      });

      if (result.kind !== "ok") {
        setLoadError(result.message);
        return null;
      }

      setLoadError(null);
      return result.data.entries;
    },
    [eventTypeFilter, userIdFilter]
  );

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const fetched = await runQuery(undefined);
    setLoading(false);

    if (fetched === null) return;
    setEntries(fetched);
    setExhausted(fetched.length < PAGE_SIZE);
  }, [runQuery]);

  // Deferred via queueMicrotask -- same reasoning as the Users page's own
  // load effect: the lint rule flags any setState reachable from the
  // effect body's synchronous execution, even one only reached after an
  // await.
  useEffect(() => {
    queueMicrotask(() => {
      loadFirstPage();
    });
  }, [loadFirstPage]);

  async function loadMore() {
    const lastId = entries[entries.length - 1]?.id;
    if (lastId === undefined) return;

    setLoadingMore(true);
    const fetched = await runQuery(lastId);
    setLoadingMore(false);

    if (fetched === null) return;
    setEntries((current) => [...current, ...fetched]);
    setExhausted(fetched.length < PAGE_SIZE);
  }

  function handleFilterSubmit(event: React.FormEvent) {
    event.preventDefault();
    loadFirstPage();
  }

  return (
    <RequireAdmin>
    <div className="flex-1 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every recorded authentication and admin event, newest first.
        </p>
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="mb-6 flex flex-wrap items-end gap-4"
      >
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Event type
          <input
            value={eventTypeFilter}
            onChange={(event) => setEventTypeFilter(event.target.value)}
            placeholder="e.g. login_failed"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          User ID (actor or target)
          <input
            value={userIdFilter}
            onChange={(event) => setUserIdFilter(event.target.value)}
            placeholder="uuid"
            className={`${inputClass} font-mono text-xs`}
          />
        </label>
        <button type="submit" className={primaryButtonClass}>
          Filter
        </button>
      </form>

      {loadError && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {loadError}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-400">No matching events.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Event</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-800">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-400">
                      {entry.created_at}
                    </td>
                    <td className="px-4 py-2 text-slate-200">
                      {entry.event_type}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {entry.actor_user_id ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {entry.target_user_id ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {entry.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <ChangeDiff
                        before={entry.before_state}
                        after={entry.after_state}
                      />
                      {hasContent(entry.metadata) && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-slate-500 hover:text-slate-300">
                            metadata
                          </summary>
                          <pre className="mt-1 whitespace-pre-wrap break-all text-slate-500">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!exhausted && (
            <div className="mt-4">
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
                className={smallButtonClass}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
    </RequireAdmin>
  );
}
