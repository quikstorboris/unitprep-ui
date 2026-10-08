import { useCallback, useEffect, useState, type DependencyList } from "react";

import type { ApiResult } from "@/lib/http";

interface AsyncResource<T> {
  /** The loaded value, `null` while loading or after a failure. */
  data: T | null;
  /** The failure message, `null` unless the last load failed. */
  error: string | null;
  loading: boolean;
  /** Loads again from scratch (back to `loading`), keeping `deps` as they are. */
  refetch: () => void;
}

/**
 * Loads one resource and keeps it in step with `deps`: it loads on mount,
 * again whenever a dependency changes or `refetch()` is called, drops back
 * to the loading state each time (so a switch never flashes the previous
 * value), and ignores an answer that arrives after a newer load started or
 * after unmount. The signal passed to `load` is aborted in those cases, for
 * a loader that can use it to cancel its request.
 *
 * This is the `queueMicrotask(async ...)` + `cancelled` flag every
 * fetch-on-mount effect in the app used to spell out by hand; the
 * microtask is what satisfies `react-hooks/set-state-in-effect`.
 */
export function useAsyncResource<T>(
  load: (signal: AbortSignal) => Promise<ApiResult<T>>,
  deps: DependencyList,
): AsyncResource<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  // Bumped by `refetch()` to re-run the effect without a dependency changing.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(async () => {
      if (controller.signal.aborted) return;
      setState({ data: null, error: null, loading: true });

      const result = await load(controller.signal);
      if (controller.signal.aborted) return;

      setState(
        result.kind === "ok"
          ? { data: result.data, error: null, loading: false }
          : { data: null, error: result.message, loading: false },
      );
    });

    return () => controller.abort();
    // `deps` is the caller's own dependency list for `load`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, generation]);

  const refetch = useCallback(() => setGeneration((g) => g + 1), []);

  return { ...state, refetch };
}
