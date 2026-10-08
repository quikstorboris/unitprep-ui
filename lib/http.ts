import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";

/**
 * The one HTTP client for the backend API. Every `lib/*` module that talks
 * to `unitprep-api` (auth, clients, client-ops, integrations, Dropbox,
 * ClickUp, ...) used to carry its own copy of the same three things --
 * `fetch(API_URL + path, { credentials: "include", ... })`, the 401 branch
 * (tell the session-expiry listener, return `unauthorized`) and the
 * `!ok` branch (read the server's own message) -- plus its own
 * declaration of the `{ kind: "ok" | "unauthorized" | "error" }` result.
 * They are all this now; each module keeps its own typed functions and its
 * own named result alias, built on this.
 *
 * `unauthorized` carries the backend's own `message` rather than a bare
 * marker: the Rust side crafts those to be exactly as vague as
 * anti-enumeration requires, and re-wording them here would put the same
 * fact in two places that could drift apart.
 */
export type ApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  /** Aborts the request; an abort comes back as an `error` result. */
  signal?: AbortSignal;
}

/**
 * The raw request: credentials included (the session cookie lives on the
 * API's own origin), and a JSON content type on every request that can
 * change something -- body or not. A cross-site HTML form cannot send
 * `application/json` without a CORS preflight, so this is what keeps a
 * bodyless POST (sign-out, a re-sync trigger) from being forgeable by a
 * form on another site. A plain GET carries no content type unless it has
 * a body. For the few callers that need the `Response` itself (file
 * downloads); everything else goes through `apiRequest`.
 */
export async function apiFetch(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    ...(method !== "GET" || body !== undefined
      ? { headers: { "Content-Type": "application/json" } }
      : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}

/** Turns a response into an `ApiResult`: 401 and non-2xx become results,
 * a 204 has no body to parse. */
export async function parseApiResult<T>(response: Response): Promise<ApiResult<T>> {
  if (response.status === 401) {
    notifyUnauthorized();
    return { kind: "unauthorized", message: await errorMessageFrom(response) };
  }

  if (!response.ok) {
    return { kind: "error", message: await errorMessageFrom(response) };
  }

  if (response.status === 204) {
    return { kind: "ok", data: undefined as T };
  }

  return { kind: "ok", data: (await response.json()) as T };
}

/** One JSON call. Never throws: a network failure (or an abort) is an
 * `error` result with the browser's reason turned into a sentence. */
export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  try {
    return await parseApiResult<T>(await apiFetch(method, path, body, options));
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}
