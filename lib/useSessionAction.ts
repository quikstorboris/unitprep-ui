"use client";

import { useState } from "react";

import { API_URL, errorMessageFrom } from "@/lib/api";

/**
 * What `run` resolved to, checked by the caller immediately after
 * awaiting it -- deliberately not left to be read back off the hook's
 * own `sessionExpired`/`error` state, since a state update scheduled
 * during `run` isn't visible in the same closure's already-captured
 * variables until the next render (a stale-closure trap). The hook's
 * `pending`/`error`/`sessionExpired` fields are for rendering the
 * button's own UI (a "Saving..." label, an inline error) — this return
 * value is for deciding what to do next.
 */
export type SessionActionResult =
  | { kind: "ok"; response: Response }
  | { kind: "sessionExpired" }
  | { kind: "error"; message: string };

interface UseSessionActionResult {
  pending: boolean;
  error: string | null;
  sessionExpired: boolean;
  /**
   * Fires the action. `extraBody` is merged alongside `session_id` in
   * the request body.
   */
  run: (
    extraBody?: Record<string, unknown>
  ) => Promise<SessionActionResult>;
}

/**
 * Fires one POST `{session_id: sessionId, ...extraBody}` to `path` on
 * demand (unlike useSessionPost, which fires on mount/sessionId
 * change). Shared shape for the "user clicked a button" family of
 * actions: the export/dedup-export download hooks, and the per-row
 * action components on ScanResultsPage (correct, exempt, exclude,
 * acknowledge) that each previously carried their own copy of this
 * exact fetch/404/error handling.
 */
export function useSessionAction(
  sessionId: string,
  path: string
): UseSessionActionResult {
  const [pending, setPending] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    sessionExpired,
    setSessionExpired,
  ] = useState(false);

  const run = async (
    extraBody?: Record<string, unknown>
  ): Promise<SessionActionResult> => {
    try {
      setPending(true);
      setError(null);
      setSessionExpired(false);

      const response = await fetch(
        `${API_URL}${path}`,
        {
          method: "POST",
          // Sends the auth session cookie once auth actually issues
          // one -- inert today (no cookie exists yet), but the seam
          // needs to exist now so wiring auth in later doesn't mean
          // grep-and-patch every fetch call site in the app.
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            ...extraBody,
          }),
        }
      );

      // 401 (not authenticated) is folded into the same
      // "sessionExpired" result as 404 (session gone) -- both mean
      // "nothing to act on, start over" from this hook's point of
      // view, and there's no dedicated login-required UI yet to
      // route a 401 to instead.
      if (
        response.status === 404 ||
        response.status === 401
      ) {
        setSessionExpired(true);
        return { kind: "sessionExpired" };
      }

      if (!response.ok) {
        const message =
          await errorMessageFrom(
            response
          );
        setError(message);
        return {
          kind: "error",
          message,
        };
      }

      return { kind: "ok", response };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unknown error";
      setError(message);
      return { kind: "error", message };
    } finally {
      setPending(false);
    }
  };

  return {
    pending,
    error,
    sessionExpired,
    run,
  };
}

// RFC 5987/6266 extended form -- charset'lang'percent-encoded-value, e.g.
// `filename*=UTF-8''r%C3%A9sum%C3%A9.zip` -- used for non-ASCII filenames.
// Not dormant forever: only today's backend, which only ever sends the
// plain ASCII form below, makes this branch unreachable in practice.
function extendedFilenameFrom(
  disposition: string
): string | null {
  const match = disposition.match(
    /filename\*=[^']*''([^;]+)/i
  );

  if (!match) return null;

  try {
    return decodeURIComponent(match[1].trim());
  } catch {
    // Malformed percent-encoding -- fall through to the plain form/default
    // rather than throw over a cosmetic filename.
    return null;
  }
}

function plainFilenameFrom(
  disposition: string
): string | null {
  const match = disposition.match(
    /filename="([^"]+)"/
  );

  return match?.[1] ?? null;
}

/**
 * Triggers a browser download for `blob`, naming it from the response's
 * `Content-Disposition` header when present, falling back to
 * `fallbackName` otherwise. Merges what were two identical copies of
 * this same filename-extraction + anchor-click dance in
 * useExportDownload and useDedupExport.
 *
 * Prefers the RFC 6266 extended `filename*=` form over the plain
 * `filename="..."` form when both are present, per RFC 6266 section 4.3 --
 * then falls back through plain -> `fallbackName`.
 */
export function downloadBlob(
  blob: Blob,
  disposition: string | null,
  fallbackName: string
): void {
  const filename =
    (disposition &&
      (extendedFilenameFrom(disposition) ??
        plainFilenameFrom(disposition))) ||
    fallbackName;

  const url =
    window.URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
}
