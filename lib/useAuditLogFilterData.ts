"use client";

import { useEffect, useMemo, useState } from "react";

import { listAuditLogEventTypes } from "@/lib/auth-audit";
import { listUsers, type UserSummary } from "@/lib/auth-users";

interface UseAuditLogFilterDataResult {
  allEventTypes: string[];
  selectedEventTypes: string[];
  setSelectedEventTypes: (eventTypes: string[]) => void;
  /** Convenience derived from allEventTypes/selectedEventTypes -- true
   * once the canonical event-type list has loaded and the user has
   * cleared every selection (as opposed to the list simply not having
   * loaded yet, when both are still empty). Zero selected means "show
   * nothing" on the backend, not "no filter". */
  noEventsSelected: boolean;
  allUsers: UserSummary[];
  /** Keyed by id -- for actor/target name+email resolution (only the
   * inline Audit Logs page needs this; the export page's preview rows
   * already carry a resolved label from the backend). */
  usersById: Map<string, UserSummary>;
  selectedUserIds: string[];
  setSelectedUserIds: (userIds: string[]) => void;
  /** Set if either the event-type list or the users list failed to load
   * -- previously dropped silently, leaving both filter dropdowns just
   * render empty with no indication why. Null once both have loaded
   * (or on the next successful retry, since neither effect re-runs on
   * its own -- a remount, e.g. navigating away and back, is what
   * retries today). */
  filterDataError: string | null;
}

/**
 * Shared filter data for both audit-log pages -- the inline table
 * (`app/(app)/admin/audit-logs/page.tsx`) and the PDF export
 * (`app/(app)/admin/audit-logs/export/page.tsx`) -- which each
 * independently fetched the same canonical event-type list and Users
 * list, seeded the same "everything selected" default, and tracked the
 * same selection state. What each page does with that selection (run a
 * paginated query vs. debounce a preview + trigger an export) stays on
 * the page -- only the fetch + selection state itself moves here.
 */
export function useAuditLogFilterData(): UseAuditLogFilterDataResult {
  const [allEventTypes, setAllEventTypes] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);

  const [usersById, setUsersById] = useState<Map<string, UserSummary>>(
    new Map()
  );
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [filterDataError, setFilterDataError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await listAuditLogEventTypes();
      if (result.kind !== "ok") {
        setFilterDataError(`Could not load event types: ${result.message}`);
        return;
      }
      setAllEventTypes(result.data.event_types);
      setSelectedEventTypes(result.data.event_types);
    });
  }, []);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await listUsers();
      if (result.kind !== "ok") {
        setFilterDataError(`Could not load users: ${result.message}`);
        return;
      }
      setUsersById(new Map(result.data.users.map((user) => [user.id, user])));
    });
  }, []);

  const allUsers = useMemo(() => Array.from(usersById.values()), [usersById]);

  const noEventsSelected =
    allEventTypes.length > 0 && selectedEventTypes.length === 0;

  return {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    usersById,
    selectedUserIds,
    setSelectedUserIds,
    filterDataError,
  };
}
