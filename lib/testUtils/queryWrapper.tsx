import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** A fresh query client for one test: no retries, and nothing garbage
 * collected mid-test, so assertions see exactly what the code under test
 * asked for. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 30_000 } },
  });
}

/** `render(ui, { wrapper: createQueryWrapper() })`. Pass your own client to
 * inspect or pre-seed the cache; a new one is made per call otherwise. */
export function createQueryWrapper(client: QueryClient = createTestQueryClient()) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
