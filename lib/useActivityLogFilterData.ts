"use client";

import { useEffect, useMemo, useState } from "react";

import { listActivityLogEventTypes } from "@/lib/activity-log";
import { listUsers, type UserSummary } from "@/lib/auth-users";

interface UseActivityLogFilterDataResult {
  allEventTypes: string[];
  selectedEventTypes: string[];
  setSelectedEventTypes: (eventTypes: string[]) => void;
  /** True once the canonical event-type list has loaded and every
   * selection has been cleared -- zero selected means "show nothing" on
   * the backend, not "no filter". See `useAuditLogFilterData`'s own
   * identical reasoning. */
  noEventsSelected: boolean;
  allUsers: UserSummary[];
  usersById: Map<string, UserSummary>;
  selectedActorIds: string[];
  setSelectedActorIds: (userIds: string[]) => void;
  filterDataError: string | null;
}

/**
 * `useAuditLogFilterData`'s counterpart for the Activity Logs pages --
 * same shared-fetch-plus-selection-state shape, minus the "actor or
 * target" duality: every activity-log row has exactly one actor and no
 * second user to filter by, so there is only one user filter here.
 */
export function useActivityLogFilterData(): UseActivityLogFilterDataResult {
  const [allEventTypes, setAllEventTypes] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);

  const [usersById, setUsersById] = useState<Map<string, UserSummary>>(new Map());
  const [selectedActorIds, setSelectedActorIds] = useState<string[]>([]);
  const [filterDataError, setFilterDataError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await listActivityLogEventTypes();
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

  const noEventsSelected = allEventTypes.length > 0 && selectedEventTypes.length === 0;

  return {
    allEventTypes,
    selectedEventTypes,
    setSelectedEventTypes,
    noEventsSelected,
    allUsers,
    usersById,
    selectedActorIds,
    setSelectedActorIds,
    filterDataError,
  };
}
