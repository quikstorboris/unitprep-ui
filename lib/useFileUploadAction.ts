"use client";

import { useState } from "react";

import {
  API_URL,
  describeFetchError,
  errorMessageFrom,
} from "@/lib/api";
import type { SessionActionResult } from "@/lib/useSessionAction";

interface UseFileUploadActionResult {
  pending: boolean;
  error: string | null;
  sessionExpired: boolean;
  /** Posts `formData` (already built by the caller) as multipart to `path`. */
  run: (formData: FormData) => Promise<SessionActionResult>;
}

/**
 * Fires one multipart POST of a caller-built `FormData` to `path`.
 * Shared shape for the "upload a file" family of actions -- the
 * tagger/dedup initial-check uploads and the master-group-file manual
 * upload each previously carried their own copy of this exact fetch/
 * 404/401/error handling. Mirrors useSessionAction's SessionActionResult
 * shape (ok/sessionExpired/error) so a caller that already branches on
 * that shape only needs to change how it obtains the result, not how it
 * consumes one.
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
 * this hook covers, not just a different endpoint/labels.
 */
export function useFileUploadAction(
  path: string
): UseFileUploadActionResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const run = async (
    formData: FormData
  ): Promise<SessionActionResult> => {
    try {
      setPending(true);
      setError(null);
      setSessionExpired(false);

      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        // The API is a different origin (different port), so cookies
        // are withheld unless this is explicit -- without it, every
        // request looks signed-out regardless of a valid session.
        credentials: "include",
        body: formData,
      });

      // 401 (not authenticated) is folded into the same "sessionExpired"
      // result as 404 (session gone) -- same reasoning as
      // useSessionAction: both mean "nothing to act on, start over" from
      // this hook's point of view.
      if (response.status === 404 || response.status === 401) {
        setSessionExpired(true);
        return { kind: "sessionExpired" };
      }

      if (!response.ok) {
        const message = await errorMessageFrom(response);
        setError(message);
        return { kind: "error", message };
      }

      return { kind: "ok", response };
    } catch (err) {
      const message = describeFetchError(err);
      setError(message);
      return { kind: "error", message };
    } finally {
      setPending(false);
    }
  };

  return { pending, error, sessionExpired, run };
}
