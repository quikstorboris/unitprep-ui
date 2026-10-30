import { QueryClient } from "@tanstack/react-query";

/**
 * How long a cached read counts as fresh. Within this window a screen that
 * mounts again (back/forward, switching tabs and back) shows the cached
 * answer and asks the API for nothing; after it, the cached answer still
 * shows at once and is refreshed in the background. An internal tool where
 * a colleague's edit appearing up to half a minute late is harmless; our
 * own writes invalidate the affected keys explicitly instead of waiting.
 */
export const QUERY_STALE_MS = 30_000;

/**
 * The one client behind every cached read. Defaults are chosen to keep
 * database compute thrifty, not to maximise freshness:
 *  - no refetch on window focus or reconnect (every refetch is an
 *    authenticated request, several Neon round trips);
 *  - no automatic retries (a failed read shows its own message and the
 *    user can retry; silent retries would multiply load during an outage).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_MS,
        gcTime: 5 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}
