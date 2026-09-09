"use client";

import { useCallback } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import EventTypeMultiSelect from "@/components/audit/EventTypeMultiSelect";
import UserMultiSelect from "@/components/audit/UserMultiSelect";
import EventCategoryTabs from "@/components/audit/EventCategoryTabs";
import ChangeDiff from "@/components/audit/ChangeDiff";
import UserCell from "@/components/audit/UserCell";
import MetadataDetails from "@/components/audit/MetadataDetails";
import { listAuditLogs, type AuditLogEntry } from "@/lib/auth-audit";
import { useAuditLogFilterData } from "@/lib/useAuditLogFilterData";
import { useInfiniteLogFeed, type LogFeedResult } from "@/lib/useInfiniteLogFeed";
import { resolveEventTypeFilter } from "@/lib/eventTypeFilter";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

// Shared by the Event type and User filter controls so the two boxes
// are visually identical rather than sizing to their own content --
// the difference Boris originally flagged.
const filterControlWidthClass = "w-64";

const PAGE_SIZE = 50;

export default function AdminSecurityLogsPage() {
  // Canonical event-type list, the Users list (both as an array for
  // UserMultiSelect and keyed by id for this page's own actor/target
  // name+email resolution below), and the live filter selections --
  // shared with the export page, which fetches/manages the exact same
  // data. Empty until each list loads; until then allEventTypes.length
  // === 0 and the "all selected" check below treats that as no filter,
  // not "select nothing".
  const {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    usersById,
    selectedUserIds,
    setSelectedUserIds,
    filterDataError,
  } = useAuditLogFilterData();

  const query = useCallback(
    async (beforeId?: number): Promise<LogFeedResult<AuditLogEntry>> => {
      // Zero selected means "show nothing", not "no filter" -- an omitted
      // event_type param and an empty one are indistinguishable to the
      // backend (both mean "don't filter"), so this has to be handled
      // here rather than by sending anything at all. noEventsSelected is
      // false (not true) before the canonical list has loaded, when
      // selectedEventTypes is also still empty.
      if (noEventsSelected) return { kind: "ok", entries: [] };

      const result = await listAuditLogs({
        limit: PAGE_SIZE,
        beforeId,
        eventType: resolveEventTypeFilter(selectedEventTypes, allEventTypes)?.join(","),
        userId: selectedUserIds.length > 0 ? selectedUserIds.join(",") : undefined,
      });

      if (result.kind !== "ok") return { kind: "error", message: result.message };
      return { kind: "ok", entries: result.data.entries };
    },
    [allEventTypes, selectedEventTypes, noEventsSelected, selectedUserIds]
  );

  const { entries, loading, loadingMore, loadError, exhausted, sentinelRef } =
    useInfiniteLogFeed(query, (entry) => entry.id, PAGE_SIZE);

  return (
    <RequirePermission permission="audit_logs.read">
    <div className="flex-1 p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Security Logs</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every recorded authentication and admin event, newest first.
          </p>
        </div>
        <Link href="/admin/security-logs/export" className={smallButtonClass}>
          Export
        </Link>
      </div>

      <EventCategoryTabs
        allEventTypes={allEventTypes}
        selectedEventTypes={selectedEventTypes}
        onChange={setSelectedEventTypes}
      />

      {/* No submit button -- every control here already reloads the list
          on change via the filter state useInfiniteLogFeed's query
          closes over, so a button would only add a click that does
          nothing a plain edit hasn't already done. */}
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
          User (actor or target)
          <UserMultiSelect
            users={allUsers}
            selected={selectedUserIds}
            onChange={setSelectedUserIds}
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
                    <td className="px-4 py-2">
                      <UserCell
                        userId={entry.actor_user_id}
                        usersById={usersById}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <UserCell
                        userId={entry.target_user_id}
                        usersById={usersById}
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {entry.ip_address ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <ChangeDiff
                        before={entry.before_state}
                        after={entry.after_state}
                      />
                      <MetadataDetails metadata={entry.metadata} className="mt-1" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {exhausted ? (
            <p className="mt-4 text-center text-xs text-slate-500">
              End of results
            </p>
          ) : (
            // Invisible trigger, not a loading indicator on its own --
            // the observer inside useInfiniteLogFeed fires once this
            // scrolls into (or near) view. loadingMore's own text is the
            // only visible feedback while a page is in flight.
            <div ref={sentinelRef} className="mt-4 h-4">
              {loadingMore && (
                <p className="text-center text-xs text-slate-500">
                  Loading…
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
    </RequirePermission>
  );
}
