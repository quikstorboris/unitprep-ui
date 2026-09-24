"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AbortableOperation {
  /**
   * Milliseconds elapsed since the current attempt's `start()`, ticking
   * every `TICK_MS` while an attempt is in flight; frozen at its last
   * value once `finish()` (or `cancel()`, which itself doesn't stop the
   * ticker -- the caller's own `finally` should still call `finish()`)
   * settles it. Reset to 0 by the next `start()`. Purely for an honest
   * "still working... 14s" label -- none of this app's upload/process/
   * export endpoints stream a real percentage back (confirmed against
   * unitprep-api's upload.rs, dedup.rs, tagger.rs, and unit_groups'
   * analyze/validate/export handlers -- each reads or produces its whole
   * response in one shot), so elapsed time is the one thing the frontend
   * can show truthfully while it waits, instead of a fake progress bar.
   */
  elapsedMs: number;

  /**
   * True once `cancel()` has fired for the attempt currently (or most
   * recently) in flight -- kept distinct from `error`, since the user
   * asking to stop is not a failure. Cleared by the next `start()`.
   */
  cancelled: boolean;

  /**
   * Begins a new attempt: resets `cancelled`/`elapsedMs` and starts the
   * elapsed-time ticker. Returns the `AbortController` for this attempt
   * -- pass its `.signal` to `fetch`, or listen for the signal's own
   * "abort" event to drive a non-fetch transport (e.g. wiring
   * `XMLHttpRequest.abort()` off of it, since XHR has no native
   * `AbortSignal` support of its own).
   */
  start: () => AbortController;

  /**
   * Stops the ticker (leaving `elapsedMs` at its final value) once the
   * attempt settles, however it settles -- success, error, or
   * cancellation. Idempotent; safe to call from a `finally` block
   * unconditionally.
   */
  finish: () => void;

  /**
   * Aborts the in-flight attempt's controller and marks `cancelled`. A
   * no-op if nothing is in flight (no attempt started, or the previous
   * one already settled).
   */
  cancel: () => void;
}

const TICK_MS = 250;

/**
 * Shared elapsed-time + AbortController bookkeeping for the app's
 * "upload/process/export" family of long-running requests -- factored
 * out so the cancel button and "Xs elapsed" label useSessionAction,
 * useSessionPost, and useFileUploadAction each now expose are one
 * implementation, not three independent copies of the same timer/
 * controller dance.
 */
export function useAbortableOperation(): AbortableOperation {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cancelled, setCancelled] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTicker = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback((): AbortController => {
    stopTicker();

    const controller = new AbortController();
    controllerRef.current = controller;
    startedAtRef.current = Date.now();

    setCancelled(false);
    setElapsedMs(0);

    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, TICK_MS);

    return controller;
  }, [stopTicker]);

  const finish = useCallback(() => {
    stopTicker();
    controllerRef.current = null;
  }, [stopTicker]);

  const cancel = useCallback(() => {
    if (!controllerRef.current) return;
    setCancelled(true);
    controllerRef.current.abort();
  }, []);

  // Stops the ticker if the component unmounts mid-request -- nothing
  // else clears this interval otherwise.
  useEffect(() => stopTicker, [stopTicker]);

  return { elapsedMs, cancelled, start, finish, cancel };
}

/**
 * Formats an elapsed-time reading as a short, honest label -- "3s",
 * "1m 04s" -- never a percentage, since none of these endpoints report
 * one. Shared by every page that renders `elapsedMs`.
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * True for the `AbortError` a `fetch` call rejects with once its
 * request's `AbortSignal` fires -- shared by every fetch-based hook here
 * so "the user cancelled" and "a real network failure" aren't
 * conflated. Native `fetch` implementations reject with a
 * `DOMException` named `AbortError` -- notably NOT a subclass of
 * `Error` in either browsers or Node, so this checks `.name` directly
 * on any object rather than narrowing with `instanceof Error` first
 * (which would silently never match a real `DOMException`). Some
 * environments (older polyfills, certain test mocks) instead throw a
 * plain `Error` with that same `.name`, which this also recognizes.
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "AbortError"
  );
}
