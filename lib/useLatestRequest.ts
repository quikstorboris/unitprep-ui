import { useCallback, useEffect, useRef } from "react";

/**
 * Guards against a slow, older request landing after a newer one.
 *
 * Call the returned `begin()` right before each request: it aborts the
 * previous request's signal and hands back a fresh one. Pass that signal
 * to the request, and ignore the result when `signal.aborted` -- an older
 * response (a filter changed again, a faster search answered first) can
 * then never overwrite the state a newer one set. Everything still in
 * flight is aborted when the component unmounts.
 */
export function useLatestRequest(): () => AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  return useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);
}
