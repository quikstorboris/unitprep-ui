"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import RequirePermission from "@/components/auth/RequirePermission";
import EventTypeMultiSelect from "@/components/audit/EventTypeMultiSelect";
import UserMultiSelect from "@/components/audit/UserMultiSelect";
import { listAuditLogs, type AuditLogEntry, type UserSummary } from "@/lib/auth";
import { useAuditLogFilterData } from "@/lib/useAuditLogFilterData";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

// Shared by the Event type and User filter controls so the two boxes
// are visually identical rather than sizing to their own content --
// the difference Boris originally flagged.
const filterControlWidthClass = "w-64";

const PAGE_SIZE = 50;

/**
 * Curated groupings over the canonical event-type list, so the filter
 * doesn't stay one long flat list as the event catalog keeps growing --
 * 22 types and counting. Not derived automatically (no reflection from
 * the backend's own `audit_log::event::ALL`): adding a new event type
 * there means adding it to a category here too, same caveat that list's
 * own doc comment already accepts for itself. A type that isn't in any
 * category still shows up under "All" -- these are curated presets for
 * the multi-select below, not a partition that could hide something.
 */
const EVENT_CATEGORIES: { label: string; eventTypes: string[] }[] = [
  {
    label: "Authentication",
    eventTypes: [
      "login_succeeded",
      "login_failed",
      "passkey_registered",
      "registration_failed",
      "session_revoked",
      "totp_enrolment_started",
      "totp_enrolment_failed",
      "totp_enrolled",
      "totp_step_up_succeeded",
      "totp_step_up_failed",
      "login_anomaly_detected",
      "session_expired_access_attempt",
      "rate_limit_rejected",
    ],
  },
  {
    label: "Permissions & Roles",
    eventTypes: [
      "authorization_failure",
      "role_granted",
      "role_revoked",
      "auth_configuration_updated",
    ],
  },
  {
    label: "Users & Access",
    eventTypes: [
      "invite_created",
      "invite_refused",
      "account_recovery_initiated",
      "user_deactivated",
      "user_reactivated",
      "audit_log_exported",
    ],
  },
];

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

/**
 * Resolves a UUID to "Name (email)" via a client-side lookup against the
 * already-fetched Users list -- no backend change needed for this: an
 * admin who can see the audit log can already see the full Users list
 * (same role gate), so this exposes nothing they didn't already have
 * access to. Falls back to `null` (render just the UUID) for an actor/
 * target who no longer appears in that list, e.g. a soft-deleted user.
 */
function resolvedUserLabel(
  userId: string | null,
  usersById: Map<string, UserSummary>
): string | null {
  if (!userId) return null;
  const user = usersById.get(userId);
  if (!user) return null;
  return `${user.first_name} ${user.last_name} (${user.email})`;
}

/** One cell's worth of actor/target rendering: resolved name+email on top,
 * the UUID underneath in smaller, muted text -- kept visible rather than
 * replaced, since it's the durable identifier if a user is later renamed
 * or removed. */
function UserCell({
  userId,
  usersById,
}: {
  userId: string | null;
  usersById: Map<string, UserSummary>;
}) {
  if (!userId) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const label = resolvedUserLabel(userId, usersById);

  return (
    <div className="text-xs">
      {label && <div className="text-slate-300">{label}</div>}
      <div className="font-mono text-slate-600">{userId}</div>
    </div>
  );
}

export default function AdminAuditLogsPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  // Canonical event-type list, the Users list (both as an array for
  // UserMultiSelect and keyed by id for this page's own actor/target
  // name+email resolution below), and the live filter selections --
  // shared with the export page, which fetches/manages the exact same
  // data. Empty until each list loads; until then allEventTypes.length
  // === 0 and the "all selected" check in runQuery treats that as no
  // filter, not "select nothing".
  const {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    usersById,
    selectedUserIds,
    setSelectedUserIds,
  } = useAuditLogFilterData();

  const runQuery = useCallback(
    async (beforeId?: number) => {
      // Zero selected means "show nothing", not "no filter" -- an omitted
      // event_type param and an empty one are indistinguishable to the
      // backend (both mean "don't filter"), so this has to be handled here
      // rather than by sending anything at all. noEventsSelected is false
      // (not true) before the canonical list has loaded, when
      // selectedEventTypes is also still empty.
      if (noEventsSelected) {
        setLoadError(null);
        return [];
      }

      // All selected means no filter at all -- an explicit event_type list
      // matching every known value would behave the same on the backend,
      // but omitting it keeps the request from silently excluding a
      // brand-new event type added to the backend after this page's
      // event-types list was fetched.
      const eventTypeParam =
        selectedEventTypes.length === allEventTypes.length
          ? undefined
          : selectedEventTypes.join(",");

      const result = await listAuditLogs({
        limit: PAGE_SIZE,
        beforeId,
        eventType: eventTypeParam,
        userId: selectedUserIds.length > 0 ? selectedUserIds.join(",") : undefined,
      });

      if (result.kind !== "ok") {
        setLoadError(result.message);
        return null;
      }

      setLoadError(null);
      return result.data.entries;
    },
    [allEventTypes, selectedEventTypes, noEventsSelected, selectedUserIds]
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

  // Lazy-load: an IntersectionObserver on a sentinel at the list's end,
  // rather than the "Load more" button this replaced. Same underlying
  // keyset pagination (loadMore/before_id) -- only the trigger changed.
  // Re-created whenever exhausted/loadingMore/loadMore itself changes
  // (loadMore's own identity changes on every successful fetch, since it
  // closes over `entries`) -- cheap to tear down and reconnect, and
  // simpler than threading a ref through to dodge that.
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
      // Fires a bit before the sentinel is actually on screen, so the next
      // page is usually ready by the time the admin scrolls to see it.
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [exhausted, loadingMore, loadMore]);

  return (
    <RequirePermission permission="audit_logs.read">
    <div className="flex-1 p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every recorded authentication and admin event, newest first.
          </p>
        </div>
        <Link href="/admin/audit-logs/export" className={smallButtonClass}>
          Export
        </Link>
      </div>

      {/* Category presets, layered on top of the full multi-select below
          rather than replacing it -- clicking one just sets which event
          types are selected, so the multi-select still shows (and allows
          fine-tuning) exactly what's active. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(() => {
          const isActive = (eventTypes: string[]) =>
            eventTypes.length === selectedEventTypes.length &&
            eventTypes.every((type) => selectedEventTypes.includes(type));

          const tabClass = (active: boolean) =>
            `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`;

          return (
            <>
              <button
                type="button"
                onClick={() => setSelectedEventTypes(allEventTypes)}
                className={tabClass(isActive(allEventTypes))}
              >
                All
              </button>
              {EVENT_CATEGORIES.map((category) => {
                const eventTypes = category.eventTypes.filter((type) =>
                  allEventTypes.includes(type)
                );
                return (
                  <button
                    key={category.label}
                    type="button"
                    onClick={() => setSelectedEventTypes(eventTypes)}
                    className={tabClass(isActive(eventTypes))}
                  >
                    {category.label}
                  </button>
                );
              })}
            </>
          );
        })()}
      </div>

      {/* No submit button -- every control here already reloads the list
          on change via loadFirstPage's own effect (it depends on runQuery,
          which depends on this filter state), so a button would only add
          a click that does nothing a plain edit hasn't already done. */}
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

          {exhausted ? (
            <p className="mt-4 text-center text-xs text-slate-500">
              End of results
            </p>
          ) : (
            // Invisible trigger, not a loading indicator on its own --
            // the observer above fires loadMore() once this scrolls into
            // (or near) view. loadingMore's own text is the only visible
            // feedback while a page is in flight.
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
