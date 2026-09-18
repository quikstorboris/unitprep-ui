import { clientsGet, clientsPost, type ClientsResult } from "@/lib/clientsApi";

export type { ClientsResult };

/** One of the three Process Street workflows a match came from. */
export type PsWorkflow = "intake" | "merchant_account" | "contract_order";

/**
 * Why a run showed up as a facility match -- mirrors `MatchedVia` in
 * `unitprep-api`'s `clients_search.rs`. A "prairie enterprises" search
 * won't literally match any facility's own Intake title, so most of a
 * company's sister facilities usually arrive as `person`, not `name`.
 */
export type MatchedVia =
  | { kind: "name" }
  | { kind: "person"; full_name: string; role: string };

/**
 * Present only when this facility's Merchant Account correlation was
 * genuinely ambiguous (2+ distinct candidate runs) -- mirrors
 * `DuplicateCandidate` in `unitprep-api`'s `clients_search.rs`. One
 * `FacilityMatch` per candidate, all sharing the same `run_id` (they're
 * the same real facility) -- group consecutive rows sharing a `run_id`
 * to render the "Potential Duplicates" bracket.
 */
export interface DuplicateCandidate {
  merchant_account_run_id: string;
  /** ISO datetime -- PS's own `audit.updatedDate` for this specific
   * Merchant Account run, the value that actually differs between
   * duplicate candidates. */
  merchant_account_updated_at: string;
}

/** Mirrors `FacilityMatch` in `unitprep-api`'s `clients_search.rs`. */
export interface FacilityMatch {
  run_id: string;
  run_name: string;
  /** `null` for a person-derived match -- no live PS call was made for it. */
  status: string | null;
  already_imported: boolean;
  matched_via: MatchedVia;
  /**
   * `null` when no Merchant Account run could be confidently correlated
   * to this facility's own Intake run (not every client uses Elavon).
   */
  company_name: string | null;
  /** ISO datetime, or null -- PS's own `audit.updatedDate` for this
   * facility's own Intake run. */
  last_activity_at: string | null;
  duplicate: DuplicateCandidate | null;
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

/**
 * A New Merchant Account run whose own title matched the query --
 * mirrors `MerchantAccountMatch` in `unitprep-api`'s `clients_search.rs`.
 * Added 2026-09-14: a facility can have a real, live Elavon application
 * with no discoverable Intake run (MSS Jenks, LLC's own case), so this
 * is searched and shown as its own list -- visibility only, **not**
 * something the UI should offer to "Add" directly, since actually
 * creating a facility still requires an Intake run (address, PMS, etc.
 * all come from Intake, never Merchant Account).
 */
export interface MerchantAccountMatch {
  run_id: string;
  run_name: string;
  status: string;
  /** ISO datetime -- PS's own `audit.updatedDate`. */
  updated_at: string;
  /** Whether some real facility already has this run attached via
   * `clients.facility_merchant_accounts` -- the Merchant Account analog
   * of `FacilityMatch.already_imported`. */
  already_linked: boolean;
}

/** Mirrors `SearchClientsResponse` in `unitprep-api`'s `clients_search.rs`. */
export interface SearchClientsResponse {
  facility_matches: FacilityMatch[];
  merchant_account_matches: MerchantAccountMatch[];
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
  return clientsGet(`/clients/search?q=${encodeURIComponent(query)}`);
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

/**
 * Triggers a Process Street sync right now, rather than waiting for the
 * nightly background one. Returns as soon as the sync has *started* --
 * poll `getSyncStatus` for progress. A 409 (surfaced as `kind: "error"`)
 * means one (manual or nightly) was already running.
 *
 * `force: true` re-syncs every run in every workflow from scratch,
 * ignoring PS's own `ps_updated_at` delta check -- real Process Street
 * API cost (see `unitprep-api`'s `sync::orchestrator::sync_runs_within`
 * doc comment), so this should stay an explicit, occasional choice, not
 * the default.
 */
export async function startSync(force = false): Promise<ClientsResult<{ started: boolean }>> {
  return clientsPost(force ? "/clients/sync?force=true" : "/clients/sync");
}

/** Poll this while a sync is running to drive a progress bar. */
export async function getSyncStatus(): Promise<ClientsResult<SyncStatus>> {
  return clientsGet("/clients/sync/status");
}
