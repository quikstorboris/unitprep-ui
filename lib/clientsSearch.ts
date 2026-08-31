import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";
import { notifyUnauthorized } from "@/lib/sessionExpiry";

/**
 * `clients`-domain API calls (`/clients/*`) -- kept in its own module
 * rather than folded into `lib/clientOps.ts` or `lib/auth-shared.ts`,
 * mirroring the backend's own separate `clients` schema (distinct from
 * both `auth` and `client_ops` -- see `unitprep-api`'s
 * `clients_search.rs` module doc for why this is its own schema).
 */
async function clientsFetch(path: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: "GET",
    credentials: "include",
  });
}

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

  return { kind: "ok", data: (await response.json()) as T };
}

async function tryClientsFetch<T>(path: string): Promise<ClientsResult<T>> {
  try {
    return await parseClientsResult<T>(await clientsFetch(path));
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/** One of the three Process Street workflows a match came from. */
export type PsWorkflow = "intake" | "merchant_account" | "contract_order";

/** Mirrors `FacilityMatch` in `unitprep-api`'s `clients_search.rs`. */
export interface FacilityMatch {
  run_id: string;
  run_name: string;
  workflow: PsWorkflow;
  status: string;
}

/** Mirrors `PersonMatch` in `unitprep-api`'s `clients_search.rs`. */
export interface PersonMatch {
  workflow: PsWorkflow;
  ps_run_id: string;
  run_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

/** Mirrors `SearchClientsResponse` in `unitprep-api`'s `clients_search.rs`. */
export interface SearchClientsResponse {
  facility_matches: FacilityMatch[];
  person_matches: PersonMatch[];
}

/**
 * Searches Process Street for a company/facility (by name, a live call)
 * and for a person (by name/email, against the locally-synced
 * `clients.ps_person_index`) in one round trip. See the backend's own
 * `clients_search::search_clients` doc comment for the two lookups this
 * runs and why a facility can legitimately show up under more than one
 * title across the three workflows.
 */
export async function searchClients(query: string): Promise<ClientsResult<SearchClientsResponse>> {
  return tryClientsFetch(`/clients/search?q=${encodeURIComponent(query)}`);
}

/** One of the states `clients_sync::sync_status` reports. */
export type SyncState = "idle" | "running" | "completed" | "failed";

/** Mirrors `SyncStatusResponse` in `unitprep-api`'s `clients_sync.rs`. */
export interface SyncStatus {
  state: SyncState;
  total_runs: number;
  processed_runs: number;
  percent: number;
  error: string | null;
}

async function clientsPostFetch(path: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, { method: "POST", credentials: "include" });
}

async function tryClientsPostFetch<T>(path: string): Promise<ClientsResult<T>> {
  try {
    return await parseClientsResult<T>(await clientsPostFetch(path));
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/**
 * Triggers a Process Street sync right now, rather than waiting for the
 * nightly background one. Returns as soon as the sync has *started* --
 * poll `getSyncStatus` for progress. A 409 (surfaced as `kind: "error"`)
 * means one (manual or nightly) was already running.
 */
export async function startSync(): Promise<ClientsResult<{ started: boolean }>> {
  return tryClientsPostFetch("/clients/sync");
}

/** Poll this while a sync is running to drive a progress bar. */
export async function getSyncStatus(): Promise<ClientsResult<SyncStatus>> {
  return tryClientsFetch("/clients/sync/status");
}
