import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";

/**
 * Every `/auth/*` fetch needs `credentials: "include"` (the session/
 * ceremony cookies are on the API's own origin, not this app's) and a
 * JSON content type -- centralised here so a call site can't forget
 * either, the same reasoning `useSessionPost`/`useSessionAction` already
 * apply to the tool endpoints.
 *
 * Shared by every `lib/auth-*` module (session, users, audit, config) --
 * none of them is more "the real auth module" than another, so the
 * request/response plumbing lives in its own file rather than being
 * owned by whichever one happened to define it first.
 */
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export async function authFetch(
  path: string,
  body?: unknown,
  method: HttpMethod = "POST"
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * Structured result every function below returns, mirroring
 * `useSessionAction`'s `SessionActionResult` shape/reasoning: a caller
 * needs the outcome as a return value it can act on immediately, not a
 * state update that isn't visible until the next render.
 *
 * `unauthorized` carries the backend's own `message` rather than a bare
 * marker -- the Rust side deliberately crafts these to be exactly as
 * vague as anti-enumeration requires ("Could not sign in with that
 * address.", never "no such user" vs. "wrong passkey"). Re-wording that
 * in the frontend would mean the same fact -- what's safe to tell an
 * anonymous caller -- living in two places that could drift out of
 * agreement; reading the message the server already wrote keeps it in
 * one.
 */
export type AuthResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

export async function parseAuthResult<T>(
  response: Response
): Promise<AuthResult<T>> {
  if (response.status === 401) {
    notifyUnauthorized();
    return { kind: "unauthorized", message: await errorMessageFrom(response) };
  }

  if (!response.ok) {
    return { kind: "error", message: await errorMessageFrom(response) };
  }

  return { kind: "ok", data: (await response.json()) as T };
}

export async function tryAuthFetch<T>(
  path: string,
  body?: unknown,
  method: HttpMethod = "POST"
): Promise<AuthResult<T>> {
  try {
    return await parseAuthResult<T>(await authFetch(path, body, method));
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/** Role keys are real, open-ended data now (`auth.roles`), not a closed
 * set -- see `listRoles()` in `lib/auth-users.ts` for the live catalog.
 * `string` rather than a union: a frontend-side union would need editing
 * every time a role is added or renamed on the backend, exactly the
 * hardcoding the backend's own move to data-driven roles/permissions was
 * meant to avoid. Lives here (not in auth-session or auth-users) because
 * both modules need it -- `WhoAmI.roles` and the users/invite/role-change
 * shapes alike. */
export type Role = string;

/** Same shape as AuthResult, but keeping the raw `Response` rather than
 * parsing it as JSON -- the caller reads it as a blob for download instead.
 * Mirrors parseAuthResult's 401/error handling since it can't reuse that
 * function directly (that one always calls response.json()). Shared by
 * every file-download export (Users CSV, the audit-log PDF), not just
 * the one that first needed it. */
export type FileDownloadResult =
  | { kind: "ok"; response: Response }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

export async function fetchForDownload(
  path: string,
  body?: unknown,
  method: "GET" | "POST" = "POST"
): Promise<FileDownloadResult> {
  try {
    const response = await authFetch(path, body, method);

    if (response.status === 401) {
      notifyUnauthorized();
      return {
        kind: "unauthorized",
        message: await errorMessageFrom(response),
      };
    }
    if (!response.ok) {
      return { kind: "error", message: await errorMessageFrom(response) };
    }
    return { kind: "ok", response };
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}
