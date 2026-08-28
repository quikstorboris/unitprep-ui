export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8080";

/**
 * Discovery's file names are actually the uploaded folder-relative path
 * (browsers send `file.webkitRelativePath` as the multipart filename for
 * a directory upload, e.g. "Wave 3/Facility A/units.csv") — the full
 * path is still the right value to key selections and API calls by
 * (two different subfolders could share a bare filename), but showing
 * it in the UI is just noise. This strips everything but the last
 * segment for display only.
 */
export function basename(
  path: string
): string {
  const segments = path.split(/[\\/]/);
  return (
    segments[segments.length - 1] ||
    path
  );
}

/**
 * Like `basename`, but keeps one directory of context — used where
 * several same-named-looking files need to stay distinguishable (e.g.
 * a master group file candidate list spanning several facility
 * subfolders) without showing the full uploaded path. Falls back to
 * `basename` alone when the file has no parent segment (sits directly
 * in the uploaded root).
 */
export function parentAndBasename(
  path: string
): string {
  const segments = path.split(/[\\/]/);
  const name =
    segments[segments.length - 1] ||
    path;

  const parent =
    segments[segments.length - 2];

  return parent
    ? `${parent}/${name}`
    : name;
}

/**
 * Extracts a human-readable message from a non-2xx API response. Most
 * failures return a structured `{ error, message }` body (see
 * ApiErrorBody in the Rust API) but a few endpoints still return a plain
 * string — fall back to the raw text, then to a bare status code, rather
 * than showing a blank error.
 */
/**
 * `fetch` throws a plain `TypeError` (not an HTTP error — the request
 * never got an HTTP response at all) when the request can't reach the
 * server: connection refused, DNS failure, CORS rejection, offline, etc.
 * The browser's own message for this ("Failed to fetch", "Load failed",
 * "NetworkError when attempting to fetch resource" depending on browser)
 * reads as a generic, unhelpful error with no indication of what's
 * actually wrong — this exists so every fetch call site can show
 * something a user can act on instead ("is the API running?") rather
 * than the raw browser string. Distinct from a non-2xx response, which
 * `errorMessageFrom` already handles with the server's own message.
 */
export function describeFetchError(
  error: unknown,
  fallback: string = "Unknown error"
): string {
  if (error instanceof TypeError) {
    return `Could not reach the API server at ${API_URL} — check that it's running and reachable from this browser.`;
  }

  return error instanceof Error
    ? error.message
    : fallback;
}

export async function errorMessageFrom(
  response: Response
): Promise<string> {
  const text = await response.text();

  let message: string;

  try {
    const body = JSON.parse(text) as {
      message?: string;
    };

    message = body.message || text || `HTTP ${response.status}`;
  } catch {
    // Not JSON — fall through to the raw text below.
    message = text || `HTTP ${response.status}`;
  }

  // The backend stamps every response with this (see unitprep-api's
  // router). Appended so a user hitting an error has one exact id to
  // hand over, instead of a developer having to grep the backend log by
  // timestamp and guesswork. Optional chaining because plenty of this
  // codebase's existing tests mock a bare {ok, status, text} object with
  // no `headers` at all -- this must degrade quietly on those, not throw.
  const requestId = response.headers?.get?.("x-request-id");

  return requestId ? `${message} (request: ${requestId})` : message;
}

/**
 * Fire-and-forget: tells the backend this session is done, freeing it
 * immediately instead of waiting out the lazy-expiry timeout. Never
 * throws — a failed cancel just means the session expires normally later.
 */
export function cancelSession(
  sessionId: string
): void {
  fetch(`${API_URL}/session/cancel`, {
    method: "POST",
    // The API is a different origin (different port), so cookies are
    // withheld unless this is explicit -- without it, the request looks
    // signed-out regardless of a valid session (harmless here, since a
    // 401 is silently swallowed the same as any other failure, but it
    // would mean this call never actually cancels anything).
    credentials: "include",
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
    }),
  }).catch(() => {});
}