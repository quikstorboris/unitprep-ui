"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import EventTypeMultiSelect from "@/components/audit/EventTypeMultiSelect";
import UserMultiSelect from "@/components/audit/UserMultiSelect";
import { listActivityLogs, type ActivityLogEntry } from "@/lib/activity-log";
import type { UserSummary } from "@/lib/auth-users";
import { useActivityLogFilterData } from "@/lib/useActivityLogFilterData";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const filterControlWidthClass = "w-64";

const PAGE_SIZE = 50;

function hasContent(value: Record<string, unknown> | null): boolean {
  return value !== null && Object.keys(value).length > 0;
}

/** Same reasoning as Security Logs' own `resolvedUserLabel`: an actor
 * who can see this page can already see the full Users list (same role
 * gate), so this exposes nothing new. `null` (render just the UUID) for
 * an actor no longer in that list -- or the `System` placeholder used by
 * a scheduled sync's own actor id, which never appears in Users at all. */
function resolvedActorLabel(userId: string | null, usersById: Map<string, UserSummary>): string | null {
  if (!userId) return null;
  if (userId === "00000000-0000-0000-0000-000000000000") return "System (scheduled sync)";
  const user = usersById.get(userId);
  if (!user) return null;
  return `${user.first_name} ${user.last_name} (${user.email})`;
}

function ActorCell({ userId, usersById }: { userId: string | null; usersById: Map<string, UserSummary> }) {
  if (!userId) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const label = resolvedActorLabel(userId, usersById);

  return (
    <div className="text-xs">
      {label && <div className="text-slate-300">{label}</div>}
      <div className="font-mono text-slate-600">{userId}</div>
    </div>
  );
}

function EntityCell({ entityType, entityId }: { entityType: string; entityId: string | null }) {
  return (
    <div className="text-xs">
      <div className="text-slate-300">{entityType}</div>
      {entityId && <div className="font-mono text-slate-600">{entityId}</div>}
    </div>
  );
}

export default function AdminActivityLogsPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    usersById,
    selectedActorIds,
    setSelectedActorIds,
    filterDataError,
  } = useActivityLogFilterData();

  const runQuery = useCallback(
    async (beforeId?: string) => {
      if (noEventsSelected) {
        setLoadError(null);
        return [];
      }

      const eventTypeParam =
        selectedEventTypes.length === allEventTypes.length ? undefined : selectedEventTypes.join(",");

      const result = await listActivityLogs({
        limit: PAGE_SIZE,
        beforeId,
        eventType: eventTypeParam,
        actorUserId: selectedActorIds.length > 0 ? selectedActorIds.join(",") : undefined,
      });

      if (result.kind !== "ok") {
        setLoadError(result.message);
        return null;
      }

      setLoadError(null);
      return result.data.entries;
    },
    [allEventTypes, selectedEventTypes, noEventsSelected, selectedActorIds]
  );

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    const fetched = await runQuery(undefined);
    setLoading(false);

    if (fetched === null) return;
    setEntries(fetched);
    setExhausted(fetched.length < PAGE_SIZE);
  }, [runQuery]);

  useEffect(() => {
    queueMicrotask(() => {
      loadFirstPage();
    });
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    const lastId = entries[entries.length - 1]?.id;
    if (lastId === undefined) return;

    setLoadingMore(true);
    const fetched = await runQuery(lastId);
    setLoadingMore(false);

    if (fetched === null) return;
    setEntries((current) => [...current, ...fetched]);
    setExhausted(fetched.length < PAGE_SIZE);
  }, [entries, runQuery]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (exhausted || loadingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([sentinelEntry]) => {
        if (sentinelEntry?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [exhausted, loadingMore, loadMore]);

  return (
    <RequirePermission permission="activity_logs.read">
      <div className="flex-1 p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Activity Logs</h1>
            <p className="mt-1 text-sm text-slate-400">
              Client imports, dedup/Unit Group runs, and Process Street syncs, newest first.
            </p>
          </div>
          <Link href="/admin/activity-logs/export" className={smallButtonClass}>
            Export
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Event type
            <EventTypeMultiSelect
              allEventTypes={allEventTypes}
              selected={selectedEventTypes}
              onChange={setSelectedEventTypes}
              className={filterControlWidthClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            User
            <UserMultiSelect
              users={allUsers}
              selected={selectedActorIds}
              onChange={setSelectedActorIds}
              className={filterControlWidthClass}
            />
          </label>
        </div>

        {filterDataError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {filterDataError}
          </p>
        )}

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-slate-400">No matching activity.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Event</th>
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Entity</th>
                    <th className="px-4 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-800">
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-400">
                        {entry.created_at}
                      </td>
                      <td className="px-4 py-2 text-slate-200">{entry.event_type}</td>
                      <td className="px-4 py-2">
                        <ActorCell userId={entry.actor_user_id} usersById={usersById} />
                      </td>
                      <td className="px-4 py-2">
                        <EntityCell entityType={entry.entity_type} entityId={entry.entity_id} />
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {hasContent(entry.metadata) && (
                          <details>
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

            {exhausted ? (
              <p className="mt-4 text-center text-xs text-slate-500">End of results</p>
            ) : (
              <div ref={sentinelRef} className="mt-4 h-4">
                {loadingMore && <p className="text-center text-xs text-slate-500">Loading…</p>}
              </div>
            )}
          </>
        )}
      </div>
    </RequirePermission>
  );
}
