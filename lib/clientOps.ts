import { apiRequest, type ApiResult } from "@/lib/http";

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

/** The shared `ApiResult` under this domain's own name. */
export type ClientOpsResult<T> = ApiResult<T>;

async function tryClientOpsFetch<T>(
  path: string,
  body?: unknown,
  method: HttpMethod = "POST"
): Promise<ClientOpsResult<T>> {
  return apiRequest<T>(method, path, body);
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
