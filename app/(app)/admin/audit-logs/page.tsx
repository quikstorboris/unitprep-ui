"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import RequireAdmin from "@/components/auth/RequireAdmin";
import EventTypeMultiSelect from "@/components/audit/EventTypeMultiSelect";
import {
  listAuditLogEventTypes,
  listAuditLogs,
  listUsers,
  type AuditLogEntry,
  type UserSummary,
} from "@/lib/auth";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

// Shared by the Event type and User ID filter controls so the two boxes
// are visually identical rather than sizing to their own content --
// the difference Boris flagged.
const filterControlWidthClass = "w-64";

const PAGE_SIZE = 50;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Name, email, or a UUID substring -- whatever the admin is most likely to
 * have on hand for a given user. */
function matchesUserQuery(user: UserSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return (
    user.id.toLowerCase().includes(needle) ||
    user.email.toLowerCase().includes(needle) ||
    `${user.first_name} ${user.last_name}`.toLowerCase().includes(needle)
  );
}

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

  // Empty until the canonical list loads -- see the effect below. Until
  // then, allEventTypes.length === 0 and the "all selected" check in
  // runQuery treats that as no filter, not "select nothing".
  const [allEventTypes, setAllEventTypes] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);

  // The user filter is a fuzzy-match autocomplete, not a raw UUID box:
  // `userSearchText` is whatever the admin is typing/has typed, and
  // `selectedUserId` is only set once they pick a suggestion (or it's
  // resolved from a directly-pasted UUID -- see the UUID_PATTERN check in
  // runQuery below). Typing again after a selection clears selectedUserId,
  // since the previously-selected user no longer matches what's on screen.
  const [userSearchText, setUserSearchText] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userFilterRef = useRef<HTMLDivElement>(null);

  // Keyed by id for the actor/target name+email resolution -- fetched once
  // up front rather than per-row, same as the Users page's own single
  // listUsers() call. Also backs the user filter's fuzzy-match suggestions.
  const [usersById, setUsersById] = useState<Map<string, UserSummary>>(
    new Map()
  );

  // Closes the user-filter dropdown on an outside click -- same pattern as
  // EventTypeMultiSelect's own outside-click handling, but that component
  // is self-contained and this filter isn't (it needs page-level state:
  // selectedUserId feeds runQuery directly), so it's not reused as-is here.
  useEffect(() => {
    if (!userDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (!userFilterRef.current?.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userDropdownOpen]);

  const userMatches = useMemo(() => {
    if (selectedUserId || !userSearchText.trim()) return [];
    return Array.from(usersById.values())
      .filter((user) => matchesUserQuery(user, userSearchText))
      .slice(0, 8);
  }, [userSearchText, usersById, selectedUserId]);

  function selectUser(user: UserSummary) {
    setSelectedUserId(user.id);
    setUserSearchText(`${user.first_name} ${user.last_name} (${user.email})`);
    setUserDropdownOpen(false);
  }

  function clearUserFilter() {
    setSelectedUserId(null);
    setUserSearchText("");
  }

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await listAuditLogEventTypes();
      if (result.kind !== "ok") return;
      setAllEventTypes(result.data.event_types);
      setSelectedEventTypes(result.data.event_types);
    });
  }, []);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await listUsers();
      if (result.kind !== "ok") return;
      setUsersById(new Map(result.data.users.map((user) => [user.id, user])));
    });
  }, []);

  const runQuery = useCallback(
    async (beforeId?: number) => {
      // Zero selected means "show nothing", not "no filter" -- an omitted
      // event_type param and an empty one are indistinguishable to the
      // backend (both mean "don't filter"), so this has to be handled here
      // rather than by sending anything at all. Checked against
      // allEventTypes.length > 0 so it doesn't fire before the canonical
      // list has loaded, when selectedEventTypes is also still empty.
      if (allEventTypes.length > 0 && selectedEventTypes.length === 0) {
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

      // selectedUserId (a picked suggestion) wins; otherwise fall back to
      // a directly-pasted UUID, so that capability isn't lost now that the
      // box is primarily a name/email search rather than a raw UUID field.
      const trimmedSearch = userSearchText.trim();
      const userIdParam =
        selectedUserId ??
        (UUID_PATTERN.test(trimmedSearch) ? trimmedSearch : undefined);

      const result = await listAuditLogs({
        limit: PAGE_SIZE,
        beforeId,
        eventType: eventTypeParam,
        userId: userIdParam,
      });

      if (result.kind !== "ok") {
        setLoadError(result.message);
        return null;
      }

      setLoadError(null);
      return result.data.entries;
    },
    [allEventTypes, selectedEventTypes, selectedUserId, userSearchText]
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

  return (
    <RequireAdmin>
    <div className="flex-1 p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every recorded authentication and admin event, newest first.
        </p>
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
        <div className="flex flex-col gap-1 text-sm text-slate-300">
          User (actor or target)
          <div ref={userFilterRef} className={`relative ${filterControlWidthClass}`}>
            <input
              value={userSearchText}
              onChange={(event) => {
                setUserSearchText(event.target.value);
                setSelectedUserId(null);
                setUserDropdownOpen(true);
              }}
              onFocus={() => setUserDropdownOpen(true)}
              placeholder="Start typing a name or email, or paste a UUID…"
              className={`${inputClass} w-full pr-7 ${selectedUserId ? "" : "text-xs"}`}
            />
            {(selectedUserId || userSearchText) && (
              <button
                type="button"
                onClick={clearUserFilter}
                aria-label="Clear user filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                ×
              </button>
            )}

            {userDropdownOpen && userMatches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded border border-slate-700 bg-slate-900 p-1 shadow-lg">
                {userMatches.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => selectUser(user)}
                    className="block w-full rounded px-2 py-1 text-left hover:bg-slate-800"
                  >
                    <div className="text-sm text-slate-200">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
