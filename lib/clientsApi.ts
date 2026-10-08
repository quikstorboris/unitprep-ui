import { apiRequest, type ApiResult } from "@/lib/http";

/**
 * Shared fetch plumbing for the `clients`-domain API (`/clients/*`) --
 * split out from `clientsSearch.ts` so `clientsSearch.ts`/
 * `clientsImport.ts`/`clientsCompanies.ts` each stay scoped to one
 * concern (search+sync / preview+create / list+archive) without three
 * copies of the same fetch wrappers. Mirrors the backend's own separate
 * `clients` schema (distinct from both `auth` and `client_ops` -- see
 * `unitprep-api`'s `clients_search.rs` module doc for why this is its
 * own schema).
 */

/** The shared `ApiResult` under this domain's own name. */
export type ClientsResult<T> = ApiResult<T>;

export async function clientsGet<T>(path: string): Promise<ClientsResult<T>> {
  return apiRequest<T>("GET", path);
}

export async function clientsPost<T>(path: string, body?: unknown): Promise<ClientsResult<T>> {
  return apiRequest<T>("POST", path, body);
}

export async function clientsPut<T>(path: string, body: unknown): Promise<ClientsResult<T>> {
  return apiRequest<T>("PUT", path, body);
}

export async function clientsDelete<T>(path: string): Promise<ClientsResult<T>> {
  return apiRequest<T>("DELETE", path);
}
