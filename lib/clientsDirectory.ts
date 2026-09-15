import { clientsGet } from "@/lib/clientsApi";
import type { ClientsResult } from "@/lib/clientsApi";
import type { CompanySummary } from "@/lib/clientsCompanies";

/**
 * The searchable/filterable Clients directory grid
 * (`app/(app)/clients/page.tsx`) -- split out from `clientsCompanies.ts`
 * (which stays scoped to the plain list + archive/delete/resync CRUD)
 * since this is a distinct concern: one combined query against `GET
 * /clients` (extended with `q` plus the four checkbox filters below)
 * and the separate `GET /clients/filter-options` lookup that seeds
 * those filters' own option lists. Mirrors the backend's own directory
 * work described in the approved plan (`sparkling-finding-rossum.md`,
 * "Frontend (unitprep-ui)" section).
 */

/** A user assigned as an Implementation Manager or Sales Rep -- both
 * concepts resolve to a real `auth.users` row (see the plan's Backend
 * section), but this page only ever needs the id to filter/group by and
 * a display name, not the full `UserSummary` shape `lib/auth-users.ts`
 * exposes for admin/user-management screens. */
export interface AssignedUserRef {
  id: string;
  name: string;
}

/**
 * Extends the plain `CompanySummary` (`lib/clientsCompanies.ts`) with
 * the two new per-company assignments the directory groups and filters
 * by. Mirrors the backend's extended `CompanySummary` in
 * `clients_companies.rs` once the directory endpoint lands there.
 */
export interface CompanyDirectoryEntry extends CompanySummary {
  implementation_manager: AssignedUserRef | null;
  sales_rep: AssignedUserRef | null;
}

export interface ClientsDirectoryQuery {
  /** Free-text search -- matches facility-side data only (company
   * name, facility name/contact info, facility people), never IM/rep/
   * state/PMS, per the backend's own doc comment for this endpoint.
   * Callers are expected to already enforce their own minimum-length
   * gate (this page's 3-character minimum) before passing this --
   * that's a UI debounce concern, not something this fetch layer
   * should own. */
  q?: string;
  implementationManagerUserIds?: string[];
  salesRepUserIds?: string[];
  states?: string[];
  previousPms?: string[];
}

/** The backend takes each of these four filters as one comma-separated
 * value in a single query param -- not repeated keys -- matching the
 * same convention `client_ops_activity_logs::ActivityLogQuery` already
 * uses for `actor_user_id`/`event_type`/`entity_type` (see
 * `clients_companies::ListCompaniesQuery`'s own doc comment). */
function setCommaSeparated(params: URLSearchParams, key: string, values: string[] | undefined) {
  if (!values || values.length === 0) return;
  params.set(key, values.join(","));
}

/**
 * The directory-page query -- `GET /clients` extended with `q` and the
 * four repeatable checkbox-filter params. Any authenticated caller, same
 * as the plain `listCompanies()` this supersedes for the Clients page
 * (see that function's own doc comment in `clientsCompanies.ts`, which
 * other, non-directory consumers of the unfiltered list still use).
 */
export async function listClientsDirectory(
  query: ClientsDirectoryQuery = {}
): Promise<ClientsResult<CompanyDirectoryEntry[]>> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  setCommaSeparated(params, "implementation_manager_user_id", query.implementationManagerUserIds);
  setCommaSeparated(params, "sales_rep_user_id", query.salesRepUserIds);
  setCommaSeparated(params, "state", query.states);
  setCommaSeparated(params, "previous_pms", query.previousPms);

  const qs = params.toString();
  return clientsGet(`/clients${qs ? `?${qs}` : ""}`);
}

/** A state option -- `name` is the canonical full name (what's shown and
 * what gets sent back as the filter value), `abbreviation` is the
 * postal code if the raw data resolved to a recognized US state (`null`
 * for an unrecognized raw value passed through as its own "name"). The
 * backend dedupes "CA" and "California" into one entry here -- see
 * `clients::us_states` on the backend. */
export interface StateOption {
  name: string;
  abbreviation: string | null;
}

export interface ClientsFilterOptions {
  states: StateOption[];
  previous_pms: string[];
  /** Every user currently assigned as an Implementation Manager or
   * Sales Rep on at least one company -- one combined list backing
   * both of those checkbox filters (a person could plausibly show up
   * as either), rather than two near-duplicate lists. Matches the
   * backend's `FilterOptionsResponse.staff` field name exactly. */
  staff: AssignedUserRef[];
}

/** Seeds the four checkbox filters with only real, in-use option
 * values, rather than a hand-maintained/hardcoded list that could drift
 * from what clients actually have. */
export async function getClientsFilterOptions(): Promise<ClientsResult<ClientsFilterOptions>> {
  return clientsGet("/clients/filter-options");
}
