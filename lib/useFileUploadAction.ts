"use client";

import { useCallback, useRef, useState } from "react";

import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";
import { useAbortableOperation } from "@/lib/useAbortableOperation";
import type { SessionActionResult } from "@/lib/useSessionAction";

interface UseFileUploadActionResult {
  pending: boolean;
  error: string | null;
  sessionExpired: boolean;
  /** True once `cancel()` has fired for the upload currently (or most
   * recently) in flight -- see useAbortableOperation. */
  cancelled: boolean;
  /** Milliseconds elapsed since the current/last `run()` started. */
  elapsedMs: number;
  /**
   * Fraction of the request body sent so far, in `[0, 1]` -- real
   * browser-reported upload progress
   * (`XMLHttpRequest.upload.onprogress`), not an estimate. `fetch` has
   * no equivalent hook for an outgoing request body (only its
   * *response* body can be read as a stream), which is why this hook
   * is built on `XMLHttpRequest` specifically rather than `fetch`.
   * `null` before the browser has reported any progress yet. Stays at
   * `1` once the bytes finish sending even though the server may still
   * be parsing the file -- pair this with `pending`, don't treat `1`
   * alone as "done".
   */
  uploadProgress: number | null;
  /** Aborts the in-flight upload, resolving `run()`'s promise with
   * `{kind: "cancelled"}`. A no-op if nothing is in flight. */
  cancel: () => void;
  /** Posts `formData` (already built by the caller) as multipart to `path`. */
  run: (formData: FormData) => Promise<SessionActionResult>;
}

/**
 * Reconstructs a `Response` from a completed `XMLHttpRequest` so
 * existing callers -- built around `SessionActionResult`'s
 * `{kind: "ok", response}` shape, calling `.json()`/`errorMessageFrom`
 * on it -- don't need their own XHR-specific branch.
 */
function responseFromXhr(xhr: XMLHttpRequest): Response {
  const headers = new Headers();

  xhr
    .getAllResponseHeaders()
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      if (!line) return;
      const separator = line.indexOf(":");
      if (separator === -1) return;

      const name = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      if (name) headers.append(name, value);
    });

  return new Response(xhr.response, {
    status: xhr.status,
    statusText: xhr.statusText,
    headers,
  });
}

/**
 * Fires one multipart POST of a caller-built `FormData` to `path`.
 * Shared shape for the "upload a file" family of actions -- the
 * tagger/dedup initial-check uploads and the master-group-file manual
 * upload each previously carried their own copy of this exact fetch/
 * 404/401/error handling.
 *
 * Built on `XMLHttpRequest` rather than `fetch` specifically so
 * `uploadProgress` is real, not simulated -- confirmed against the
 * backend (unitprep-api's upload.rs, dedup.rs, tagger.rs) that none of
 * these endpoints stream a percentage back, so bytes-sent is the one
 * leg of the round trip that can be reported truthfully; the server's
 * own parse/process time after the upload finishes is still only
 * visible as elapsed time, same as every other hook in this file.
 * Cancellation is still exposed as a single `AbortController`-shaped
 * `cancel()` (via useAbortableOperation) even though XHR itself has no
 * native `AbortSignal` support -- `cancel()` aborts the shared
 * controller, and this hook wires that controller's "abort" event to
 * `xhr.abort()` for the request currently in flight.
 *
 * FormData construction is deliberately left to the caller -- what goes
 * into it (a single file vs. several, a sidecar session_id field, extra
 * metadata fields like file_modified_times) differs enough per call site
 * that folding it in here wouldn't remove real duplication, just
 * relocate it behind a wider, harder-to-read parameter list.
 *
 * Not used by every upload call site in the app: `useDiscoveryFlow`'s
 * `/upload` POST kicks off a brand-new session (no session_id exists yet
 * to expire) and is immediately chained into a second, non-multipart
 * `/discover` call with its own integrity-check gating -- a genuinely
 * different shape from "one multipart POST, fold 404/401, done" that
 * this hook covers, not just a different endpoint/labels. It keeps its
 * own `fetch`-based upload (with the same cancel/elapsed treatment via
 * useAbortableOperation directly) rather than adopting this hook, since
 * unifying cancel/elapsed across its two chained requests (upload, then
 * discover) under one AbortController was simpler than reconciling two
 * separate progress fractions from two separate hook instances.
 */
export function useFileUploadAction(path: string): UseFileUploadActionResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const { elapsedMs, cancelled, start, finish, cancel } =
    useAbortableOperation();

  // Kept alongside the AbortController purely so a stray late XHR event
  // (there shouldn't be one once the request has settled, but nothing
  // guarantees a browser never fires one) can't call `resolve` a second
  // time or flip state after this attempt is already done.
  const settledRef = useRef(false);

  const run = useCallback(
    (formData: FormData): Promise<SessionActionResult> => {
      const controller = start();
      settledRef.current = false;

      setPending(true);
      setError(null);
      setSessionExpired(false);
      setUploadProgress(0);

      return new Promise<SessionActionResult>((resolve) => {
        const xhr = new XMLHttpRequest();

        const settle = (result: SessionActionResult) => {
          if (settledRef.current) return;
          settledRef.current = true;

          setPending(false);
          finish();
          resolve(result);
        };

        controller.signal.addEventListener("abort", () => {
          xhr.abort();
        });

        xhr.open("POST", `${API_URL}${path}`);
        // The API is a different origin (different port), so cookies
        // are withheld unless this is explicit -- without it, the
        // request looks signed-out regardless of a valid session.
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setUploadProgress(event.total > 0 ? event.loaded / event.total : 1);
        };

        xhr.onabort = () => {
          settle({ kind: "cancelled" });
        };

        xhr.onerror = () => {
          const message = describeFetchError(new TypeError("Failed to fetch"));
          setError(message);
          settle({ kind: "error", message });
        };

        xhr.onload = () => {
          const status = xhr.status;
          const response = responseFromXhr(xhr);

          // 401 (not authenticated) is folded into the same
          // "sessionExpired" result as 404 (session gone) -- same
          // reasoning as useSessionAction: both mean "nothing to act
          // on, start over" from this hook's point of view, but only a
          // real 401 means the *auth* session is gone, so only that
          // one calls notifyUnauthorized().
          if (status === 404 || status === 401) {
            if (status === 401) notifyUnauthorized();
            setSessionExpired(true);
            settle({ kind: "sessionExpired" });
            return;
          }

          if (status < 200 || status >= 300) {
            errorMessageFrom(response).then((message) => {
              setError(message);
              settle({ kind: "error", message });
            });
            return;
          }

          settle({ kind: "ok", response });
        };

        xhr.send(formData);
      });
    },
    [path, start, finish]
  );

  return {
    pending,
    error,
    sessionExpired,
    cancelled,
    elapsedMs,
    uploadProgress,
    cancel,
    run,
  };
}
