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

  try {
    const body = JSON.parse(text) as {
      message?: string;
    };

    if (body.message) {
      return body.message;
    }
  } catch {
    // Not JSON — fall through to the raw text below.
  }

  return text || `HTTP ${response.status}`;
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
    headers: {
      "Content-Type":
        "application/json",
    },
    body: JSON.stringify({
      session_id: sessionId,
    }),
  }).catch(() => {});
}