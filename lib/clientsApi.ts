import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";

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

/** Same shape/reasoning as `lib/clientOps.ts`'s `ClientOpsResult`. */
export type ClientsResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

async function parseClientsResult<T>(response: Response): Promise<ClientsResult<T>> {
  if (response.status === 401) {
    notifyUnauthorized();
    return { kind: "unauthorized", message: await errorMessageFrom(response) };
  }

  if (!response.ok) {
    return { kind: "error", message: await errorMessageFrom(response) };
  }

  // A 204 (e.g. archive/unarchive) has no body to parse.
  if (response.status === 204) {
    return { kind: "ok", data: undefined as T };
  }

  return { kind: "ok", data: (await response.json()) as T };
}

export async function clientsGet<T>(path: string): Promise<ClientsResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "GET",
      credentials: "include",
    });
    return await parseClientsResult<T>(response);
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

export async function clientsPost<T>(path: string, body?: unknown): Promise<ClientsResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      ...(body !== undefined
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
    return await parseClientsResult<T>(response);
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

export async function clientsDelete<T>(path: string): Promise<ClientsResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
    });
    return await parseClientsResult<T>(response);
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}
