"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useCurrentUser } from "@/lib/currentUser";
import { makeQueryClient } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { onWriteSucceeded } from "@/lib/writeEvents";

/**
 * Mounts the shared query cache. Must sit inside `CurrentUserProvider`,
 * because the cache holds one signed-in user's data and must never outlive
 * that user: it is emptied when the user signs out (or the session ends),
 * and when a different user turns out to be signed in on the same tab, so
 * the next person never sees the previous person's company data, not even
 * for the moment before a refetch.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  const { user, checked } = useCurrentUser();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.user_id ?? null;

    if (checked && userId === null) {
      client.clear();
      lastUserId.current = null;
      return;
    }

    if (userId !== null) {
      if (lastUserId.current !== null && lastUserId.current !== userId) {
        client.clear();
      }
      lastUserId.current = userId;
    }
  }, [client, user, checked]);

  // After any successful write under /clients/<id>, mark that company's
  // cached reads (detail, facilities, policies) stale -- WITHOUT refetching
  // them here: whatever is on screen is refreshed by its own screen's
  // explicit invalidation (one request), and everything else simply
  // refetches the next time it is shown, instead of serving a pre-write
  // answer as fresh for up to the freshness window.
  useEffect(
    () =>
      onWriteSucceeded((path) => {
        const companyId = /^\/clients\/([^/?#]+)/.exec(path)?.[1];
        if (companyId) {
          void client.invalidateQueries({ queryKey: queryKeys.company(companyId), refetchType: "none" });
        }
      }),
    [client],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
