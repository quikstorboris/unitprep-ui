import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";

/**
 * Client-ops-domain API calls (`/client-ops/*`) -- kept in its own module
 * rather than folded into `lib/auth.ts`, mirroring the backend's own
 * split of `client_ops` into a schema separate from `auth` (see
 * `unitprep-api`'s `client_ops` module doc). The one concrete difference
 * from `lib/auth.ts`'s `authFetch`: the qms-tags activation endpoints are
 * `PATCH`, which `authFetch`'s `HttpMethod` union doesn't include, so
 * this gets its own small fetch helper rather than widening that one for
 * a single caller outside its domain.
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH";

async function clientOpsFetch(
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

/** Same shape/reasoning as `lib/auth.ts`'s `AuthResult`. */
export type ClientOpsResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

async function parseClientOpsResult<T>(
  response: Response
): Promise<ClientOpsResult<T>> {
  if (response.status === 401) {
    notifyUnauthorized();
    return { kind: "unauthorized", message: await errorMessageFrom(response) };
  }

  if (!response.ok) {
    return { kind: "error", message: await errorMessageFrom(response) };
  }

  return { kind: "ok", data: (await response.json()) as T };
}

async function tryClientOpsFetch<T>(
  path: string,
  body?: unknown,
  method: HttpMethod = "POST"
): Promise<ClientOpsResult<T>> {
  try {
    return await parseClientOpsResult<T>(
      await clientOpsFetch(path, body, method)
    );
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/** Mirrors `QmsTag` in `unitprep-api`'s `client_ops_qms_tags.rs`. */
export interface QmsTag {
  tag_key: string;
  label: string;
  category: string;
  is_active: boolean;
}

/**
 * The full hand-maintained QMS merge-tag catalog -- every row, active or
 * not, so this one call backs both "browse the catalog" and "find a
 * deactivated tag to reactivate" without a second endpoint. Read is open
 * to any authenticated caller on the backend (no permission gate); this
 * page still sits behind `client_ops.manage_tags` via `RequirePermission`
 * since a read-only view of a catalog nobody can act on isn't useful.
 */
export async function listQmsTags(): Promise<
  ClientOpsResult<{ tags: QmsTag[] }>
> {
  return tryClientOpsFetch("/client-ops/qms-tags", undefined, "GET");
}

export async function createQmsTag(
  tagKey: string,
  label: string,
  category: string
): Promise<ClientOpsResult<QmsTag>> {
  return tryClientOpsFetch(
    "/client-ops/qms-tags",
    { tag_key: tagKey, label, category },
    "POST"
  );
}

export async function updateQmsTag(
  tagKey: string,
  label: string,
  category: string
): Promise<ClientOpsResult<QmsTag>> {
  return tryClientOpsFetch(
    `/client-ops/qms-tags/${encodeURIComponent(tagKey)}`,
    { label, category },
    "PUT"
  );
}

/** Never a hard delete -- see the migration's own reasoning: a template
 * already referencing a tag must keep it resolvable, or at least visible
 * as deactivated, rather than have it disappear outright. */
export async function deactivateQmsTag(
  tagKey: string
): Promise<ClientOpsResult<QmsTag>> {
  return tryClientOpsFetch(
    `/client-ops/qms-tags/${encodeURIComponent(tagKey)}/deactivate`,
    undefined,
    "PATCH"
  );
}

export async function reactivateQmsTag(
  tagKey: string
): Promise<ClientOpsResult<QmsTag>> {
  return tryClientOpsFetch(
    `/client-ops/qms-tags/${encodeURIComponent(tagKey)}/reactivate`,
    undefined,
    "PATCH"
  );
}
