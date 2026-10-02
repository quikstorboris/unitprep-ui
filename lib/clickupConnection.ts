"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getClickUpConnection, type ClickUpConnection } from "@/lib/clickup";

// One shared copy of "what is the signed-in user's ClickUp connection
// status", read by both the left nav's red/green dot and the ClickUp
// page itself -- so saving, testing, or removing a token on the page
// updates the dot immediately, with no refetch and no prop drilling
// through the layout. Same module-level-store + useSyncExternalStore
// shape as `lib/currentUser.tsx`, for the same reason: an effect that
// calls `setState` directly trips this codebase's
// `react-hooks/set-state-in-effect` rule, and routing the update through
// an external store is the sanctioned alternative.
//
// Keyed by user id: the store lives for the life of the tab, and a
// different user signing in on the same tab must never see the previous
// user's connection status.

interface Snapshot {
  userId: string | null;
  connection: ClickUpConnection | null;
  /** True once a fetch for `userId` has settled, successfully or not --
   * lets the dot show "unknown" instead of a misleading red while the
   * first request is still in flight. */
  loaded: boolean;
}

let snapshot: Snapshot = { userId: null, connection: null, loaded: false };
let inflightFor: string | null = null;

const listeners = new Set<() => void>();

function commit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

const SERVER_SNAPSHOT: Snapshot = { userId: null, connection: null, loaded: false };

function getServerSnapshot(): Snapshot {
  return SERVER_SNAPSHOT;
}

/** Called by the ClickUp page after it saves/tests/removes, so the nav
 * dot reflects the new state without another round trip. */
export function setClickUpConnection(userId: string, connection: ClickUpConnection) {
  commit({ userId, connection, loaded: true });
}

/** Test seam -- resets the module-level store between tests. */
export function resetClickUpConnectionForTests() {
  inflightFor = null;
  commit({ userId: null, connection: null, loaded: false });
}

/**
 * The signed-in user's ClickUp connection, fetched once per user.
 * Pass `userId = null` when the user lacks the `integrations.clickup`
 * permission (or isn't signed in): nothing is fetched and nothing is
 * shown.
 */
export function useClickUpConnection(userId: string | null): {
  connection: ClickUpConnection | null;
  loaded: boolean;
} {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (userId === null) return;
    if (current.userId === userId && current.loaded) return;
    if (inflightFor === userId) return;

    inflightFor = userId;
    queueMicrotask(async () => {
      const result = await getClickUpConnection();
      if (inflightFor === userId) inflightFor = null;

      // A fetch that failed (network, 5xx) leaves the dot "unknown"
      // rather than claiming a state it could not confirm.
      commit({
        userId,
        connection: result.kind === "ok" ? result.data : null,
        loaded: result.kind === "ok",
      });
    });
  }, [userId, current.userId, current.loaded]);

  // Never surface another user's cached state.
  if (userId === null || current.userId !== userId) {
    return { connection: null, loaded: false };
  }

  return { connection: current.connection, loaded: current.loaded };
}
