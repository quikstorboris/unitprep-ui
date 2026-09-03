import { clientsPost, type ClientsResult } from "@/lib/clientsApi";

/**
 * "Add to OO" -- the preview (review) + create round trip behind the
 * confirmation screen at `/clients/new`. Kept separate from
 * `clientsSearch.ts` (finding candidates) and `clientsCompanies.ts`
 * (the resulting list) -- three different concerns sharing one small
 * fetch layer (`clientsApi.ts`), not one growing file.
 */

/** Mirrors `MappedCompany` in `unitprep-api`'s `clients::intake_mapping`. */
export interface MappedCompany {
  legal_name: string | null;
  corporate_email: string | null;
  corporate_phone: string | null;
  corporate_address_street: string | null;
  corporate_address_city: string | null;
  corporate_address_state: string | null;
  corporate_address_zip: string | null;
  subdomain: string | null;
  accepted_payment_methods: string | null;
  accounting_basis: string | null;
  payment_scheme: string | null;
  offers_tenant_insurance_raw: string | null;
  insurance_provider: string | null;
  /** No PS field of its own -- see the backend's own doc comment on
   * `MappedCompany::website_url`. Only ever set by the confirmation
   * screen's "use this facility's own info" fallback (offered when the
   * Corporate Info section came back entirely blank), never by PS
   * itself. */
  website_url: string | null;
}

/**
 * Mirrors `MappedFacility` in `unitprep-api`'s `clients::intake_mapping`
 * -- the PREVIEW shape, which includes `go_live_date` for display. The
 * CREATE request instead uses `EditableFacilityFields` below, which
 * omits it -- see that type's own comment for why.
 */
export interface MappedFacility {
  name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  units_count: number | null;
  primary_storage_offering: string | null;
  previous_pms: string | null;
  access_control_system: string | null;
  /** ISO date string (e.g. "2026-01-15") or null. Read-only -- labeled
   * "Original Go Live Date" on the confirmation screen. */
  go_live_date: string | null;
  dropbox_folder_url: string | null;
  subdomain: string | null;
  subdomain_exists_in_qms_raw: string | null;
  system_email: string | null;
  /** PS's own `What_is_the_URL_for_this_facility?` -- the facility's
   * real business website, distinct from `subdomain` (the QMS-hosted
   * tenant portal). */
  website_url: string | null;
}

/**
 * `MappedFacility` minus `go_live_date` -- the fields the confirmation
 * screen actually shows and lets a manager edit. Mirrors
 * `EditableFacilityFields` in `unitprep-api`'s `clients::create`:
 * deliberately narrower than `MappedFacility` so a go-live-date edit is
 * structurally impossible to submit, not just a UI convention.
 */
export type EditableFacilityFields = Omit<MappedFacility, "go_live_date">;

/** Mirrors `PreviewedRun` in `unitprep-api`'s `clients_preview.rs`. */
export interface PreviewedRun {
  run_id: string;
  /** PS's own "Is this their first time filling out this form?" for
   * this run -- `null` when unanswered. Used by `pickCompanySourceRun`
   * (this file's own consumer, `app/(app)/clients/new/page.tsx`) to
   * prefer the run PS itself marks authoritative for company data. */
  is_first_time: boolean | null;
  company: MappedCompany;
  facility: MappedFacility;
  /** The Merchant Account run this run correlates to, if any -- carried
   * straight through to `createClient` so Elavon data actually gets
   * ingested (2026-09-03 fix; previously resolved here and silently
   * dropped before Create ever saw it). */
  merchant_account_run_id: string | null;
}

/** Mirrors `PreviewClientsResponse` in `unitprep-api`'s `clients_preview.rs`. */
export interface PreviewClientsResponse {
  runs: PreviewedRun[];
}

/**
 * One selected run to preview -- `run_name` is the raw PS title already
 * known from the search step (`FacilityMatch.run_name`), passed through
 * rather than re-derived, so the backend can correlate a Merchant
 * Account run *before* fetching this run's own Intake fields instead of
 * after. See `unitprep-api`'s `clients_preview.rs` module doc for why
 * that ordering roughly halves how long this call takes.
 */
export interface PreviewRunSelection {
  run_id: string;
  run_name: string;
  /**
   * Set when this run was one of the search page's "Potential
   * Duplicates" candidates and the user picked *this specific*
   * Merchant Account run there (`FacilityMatch.duplicate.
   * merchant_account_run_id`) -- always overrides whatever the backend
   * would otherwise auto-correlate for this run, since the ambiguity
   * search surfaced is already resolved by the time this exists. See
   * the backend's own `clients_preview.rs` module doc.
   */
  merchant_account_run_id?: string | null;
}

/**
 * Live-fetches and maps every selected Intake run for review -- writes
 * nothing. Every run comes back with both a `company` and `facility`
 * view; the confirmation screen's own Company/Facility toggle per row
 * decides which one is actually used when `createClient` is called.
 */
export async function previewClients(
  runs: PreviewRunSelection[]
): Promise<ClientsResult<PreviewClientsResponse>> {
  return clientsPost("/clients/preview", { runs });
}

export interface CreateFacilitySelection {
  run_id: string;
  fields: EditableFacilityFields;
  /** Mirrors `PreviewedRun.merchant_account_run_id` -- see that field's
   * own comment. */
  merchant_account_run_id?: string | null;
}

export interface CreateClientRequest {
  company_intake_run_id: string;
  company: MappedCompany;
  facilities: CreateFacilitySelection[];
}

/** Mirrors `CreateClientResponse` in `unitprep-api`'s `clients_create.rs`. */
export interface CreateClientResponse {
  company_id: string;
  facility_ids: string[];
}

/**
 * The real "Add to OO" trigger -- creates one `clients.companies` row
 * (from `company_intake_run_id` + the reviewed `company` fields) and
 * one `clients.facilities` row per entry in `facilities`. A 409
 * (surfaced as `kind: "error"`) means one or more of the selected runs
 * is already imported -- re-check with a fresh search/preview rather
 * than retrying blindly.
 */
export async function createClient(request: CreateClientRequest): Promise<ClientsResult<CreateClientResponse>> {
  return clientsPost("/clients", request);
}
