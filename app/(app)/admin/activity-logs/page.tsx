"use client";

import { useCallback } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import EventTypeMultiSelect from "@/components/audit/EventTypeMultiSelect";
import UserMultiSelect from "@/components/audit/UserMultiSelect";
import ActorCell from "@/components/audit/ActorCell";
import EntityCell from "@/components/audit/EntityCell";
import MetadataDetails from "@/components/audit/MetadataDetails";
import { listActivityLogs, type ActivityLogEntry } from "@/lib/activity-log";
import { useActivityLogFilterData } from "@/lib/useActivityLogFilterData";
import { useInfiniteLogFeed, type LogFeedResult } from "@/lib/useInfiniteLogFeed";
import { resolveEventTypeFilter } from "@/lib/eventTypeFilter";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const filterControlWidthClass = "w-64";

const PAGE_SIZE = 50;

export default function AdminActivityLogsPage() {
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

  const query = useCallback(
    async (beforeId?: string): Promise<LogFeedResult<ActivityLogEntry>> => {
      if (noEventsSelected) return { kind: "ok", entries: [] };

      const result = await listActivityLogs({
        limit: PAGE_SIZE,
        beforeId,
        eventType: resolveEventTypeFilter(selectedEventTypes, allEventTypes)?.join(","),
        actorUserId: selectedActorIds.length > 0 ? selectedActorIds.join(",") : undefined,
      });

      if (result.kind !== "ok") return { kind: "error", message: result.message };
      return { kind: "ok", entries: result.data.entries };
    },
    [allEventTypes, selectedEventTypes, noEventsSelected, selectedActorIds]
  );

  const { entries, loading, loadingMore, loadError, exhausted, sentinelRef } =
    useInfiniteLogFeed(query, (entry) => entry.id, PAGE_SIZE);

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
                        <MetadataDetails metadata={entry.metadata} />
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
