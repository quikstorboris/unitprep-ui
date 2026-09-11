import { clientsDelete, clientsGet, clientsPost, clientsPut, type ClientsResult } from "@/lib/clientsApi";
import type { ToolRunSummary } from "@/types/api";

/**
 * Read endpoints behind Phase 4's Client record UI -- the Company page
 * and a facility's own General/Facility Policies/Elavon tabs. Mirrors
 * `unitprep-api`'s `api::clients_detail` module, plus (2026-09-03)
 * `api::clients_elavon`'s manual link action -- the one write call in
 * this file, since it's the same "a facility's own Elavon data" concern
 * as the read side, not a separate one.
 */

export interface FacilitySummary {
  id: string;
  name: string;
  dropbox_folder_url: string | null;
}

export interface OwnerInfo {
  facility_id: string;
  facility_name: string;
  party_role: "owner" | "signer";
  display_name: string | null;
  title: string | null;
  ownership_percent: number | null;
  email: string | null;
  phone: string | null;
  ssn: string | null;
  dob: string | null;
  home_address_line1: string | null;
  home_city: string | null;
  home_state_or_province: string | null;
  home_postal_code: string | null;
}

/** Mirrors `CompanyDetailResponse` in `unitprep-api`'s `clients_detail.rs`. */
export interface CompanyDetail {
  id: string;
  legal_name: string;
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
  website_url: string | null;
  archived_at: string | null;
  elavon_active: boolean;
  facilities: FacilitySummary[];
  owners: OwnerInfo[];
}

export async function getCompanyDetail(companyId: string): Promise<ClientsResult<CompanyDetail>> {
  return clientsGet(`/clients/${companyId}`);
}

/** Mirrors `FacilityDetailResponse`. */
export interface FacilityDetail {
  id: string;
  company_id: string;
  name: string;
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
  go_live_date: string | null;
  dropbox_folder_url: string | null;
  subdomain: string | null;
  subdomain_exists_in_qms_raw: string | null;
  system_email: string | null;
  website_url: string | null;
}

export async function getFacilityDetail(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<FacilityDetail>> {
  return clientsGet(`/clients/${companyId}/facilities/${facilityId}`);
}

/** Mirrors `FacilityPoliciesResponse` and its row types. */
export interface FeeRow {
  fee_type: string;
  label: string | null;
  raw_value: string;
}

/** Legacy free-text shape -- read-only history, see the backend's
 * `TaxesRow` doc comment. Superseded by `TaxEntry` below. */
export interface TaxesRow {
  sales_tax_applies_raw: string | null;
  sales_tax_rate_raw: string | null;
  rent_tax_applies_raw: string | null;
  rent_tax_rate_raw: string | null;
  rent_tax_applies_to_all_units_raw: string | null;
  other_one_time_taxes_raw: string | null;
  other_recurring_taxes_raw: string | null;
}

/** Legacy free-text shape -- read-only history, see the backend's
 * `DelinquencyStepRow` doc comment. Superseded by `DelinquencyEntry`
 * below. */
export interface DelinquencyStepRow {
  step_order: number;
  step_type: string;
  raw_value: string;
}

export interface TaxEntry {
  id: number;
  tax_type: string;
  tax_name: string;
  description: string | null;
  flat_amount: number | null;
  attribute_payable_percent: number | null;
  is_recurring: boolean;
  sort_order: number;
}

export interface TaxEntryInput {
  tax_type: string;
  tax_name: string;
  description: string | null;
  flat_amount: number | null;
  attribute_payable_percent: number | null;
  is_recurring: boolean;
}

export interface DelinquencyEntry {
  id: number;
  category: string;
  name: string;
  amount: number;
  days_after: number | null;
  trigger_type: string;
  trigger_category: string | null;
  sort_order: number;
}

export interface DelinquencyEntryInput {
  category: string;
  name: string;
  amount: number;
  days_after: number | null;
  trigger_type: string;
  trigger_category: string | null;
}

export interface CoverageTierRow {
  tier_number: number;
  total_coverage_amount_raw: string | null;
  cost_to_tenant_raw: string | null;
}

export interface CommissionRow {
  commission_type_raw: string | null;
  dollar_amount_raw: string | null;
  percent_amount_raw: string | null;
}

export interface FacilityPolicies {
  fees: FeeRow[];
  /** Legacy free-text history -- see `TaxesRow`'s own comment. */
  taxes: TaxesRow | null;
  tax_entries: TaxEntry[];
  /** Legacy free-text history -- see `DelinquencyStepRow`'s own comment. */
  delinquency_steps: DelinquencyStepRow[];
  delinquency_entries: DelinquencyEntry[];
  coverage_tiers: CoverageTierRow[];
  commission: CommissionRow | null;
  specials_raw_text: string | null;
  /** This facility's own `previous_pms` names QSX -- see the backend's
   * `clients::policy_exemption` module doc. Drives the "no PS data for
   * this category" banner on an empty category's read view. */
  is_qsx_legacy: boolean;
  fees_manually_exempt: boolean;
  taxes_manually_exempt: boolean;
  delinquency_manually_exempt: boolean;
  coverage_manually_exempt: boolean;
  specials_manually_exempt: boolean;
}

export async function getFacilityPolicies(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<FacilityPolicies>> {
  return clientsGet(`/clients/${companyId}/facilities/${facilityId}/policies`);
}

export async function updateFacilityFees(
  companyId: string,
  facilityId: string,
  fees: FeeRow[]
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/policies/fees`, { fees });
}

export async function updateFacilityTaxes(
  companyId: string,
  facilityId: string,
  taxes: TaxEntryInput[]
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/policies/taxes`, { taxes });
}

export async function updateFacilityDelinquency(
  companyId: string,
  facilityId: string,
  entries: DelinquencyEntryInput[]
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/policies/delinquency`, { entries });
}

export async function updateFacilityCoverage(
  companyId: string,
  facilityId: string,
  tiers: CoverageTierRow[],
  commission: CommissionRow | null
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/policies/coverage`, { tiers, commission });
}

export async function updateFacilitySpecials(
  companyId: string,
  facilityId: string,
  rawText: string | null
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/policies/specials`, { raw_text: rawText });
}

/** Mirrors `ElavonPartyInfo` in `unitprep-api`'s `clients_elavon.rs`. */
export interface ElavonPartyInfo {
  party_role: string;
  display_name: string | null;
  title: string | null;
  ownership_percent: number | null;
  email: string | null;
  phone: string | null;
  ssn: string | null;
  dob: string | null;
  home_address_line1: string | null;
  home_city: string | null;
  home_state_or_province: string | null;
  home_postal_code: string | null;
}

/**
 * Mirrors `ElavonFinancials` -- EIN (unmasked) and bank routing/account
 * numbers (masked to their last 4 digits by the backend, `mask_bank_number`)
 * decrypted from `encrypted_secrets`, plus the revenue/volume fields New
 * Merchant Account's Facility Information (Pre-App) step captures.
 * Confirmed genuinely per-facility (2026-09-03) -- Prairie Enterprises'
 * 3 real facilities each answered these differently on their own
 * separate runs -- so this lives on the Elavon tab, not the Company
 * page's Financial Information section.
 */
export interface ElavonFinancials {
  ein: string | null;
  bank_routing_number_masked: string | null;
  bank_account_number_masked: string | null;
  total_annual_business_revenue_raw: string | null;
  total_monthly_sales_raw: string | null;
  average_credit_card_payment_amount_raw: string | null;
  highest_credit_card_payment_amount_raw: string | null;
  high_cc_payment_times_per_year_raw: string | null;
  offers_ach_raw: string | null;
  annual_electronic_check_volume_raw: string | null;
  average_electronic_check_amount_raw: string | null;
  maximum_electronic_check_amount_raw: string | null;
}

/** Mirrors `ElavonCandidate`. */
export interface ElavonCandidate {
  merchant_account_run_id: string;
  run_name: string;
  updated_at: string;
}

/**
 * Mirrors `ElavonQmsCredentials` -- the "Add Credentials to QMS"
 * checklist step's own 3 lines (2026-09-09). `account_id`/`pin_password`
 * are real decrypted values straight from Process Street; `user_id` is
 * always the literal `"QSSWEB"` -- QuikStor's own fixed QMS web login
 * username, static text in that task's own template, not a per-facility
 * field.
 */
export interface ElavonQmsCredentials {
  account_id: string | null;
  user_id: string;
  pin_password: string | null;
}

/**
 * Mirrors `ElavonPinpadCredentials` -- present only for a client that
 * actually got a pin pad, per the same PS ticket's own "If customer got
 * a Pin Pad" conditional; both fields `null` otherwise.
 */
export interface ElavonPinpadCredentials {
  pinpad_user_id: string | null;
  qss_api_pin: string | null;
}

/**
 * Mirrors `ElavonStatusResponse` -- a serde `tag = "status"` enum, so
 * the discriminant is the `status` field itself, not a wrapper.
 */
export type ElavonStatus =
  | {
      status: "linked";
      rate_provided: string | null;
      application_status: string | null;
      credentials_added_to_qms: boolean;
      ps_new_merchant_run_id: string | null;
      last_synced_at: string | null;
      parties: ElavonPartyInfo[];
      financials: ElavonFinancials;
      qms_credentials: ElavonQmsCredentials;
      pinpad_credentials: ElavonPinpadCredentials;
    }
  | {
      status: "unlinked";
      /** Present only when title correlation found exactly one
       * candidate -- never auto-suggested when ambiguous or absent,
       * see the backend's own module doc. */
      candidate: ElavonCandidate | null;
      /** Populated instead of `candidate` when correlation found more
       * than one match (a real duplicate submission) -- shown as real
       * options rather than forcing pure manual entry. */
      ambiguous_candidates: ElavonCandidate[];
    };

export async function getFacilityElavon(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<ElavonStatus>> {
  return clientsGet(`/clients/${companyId}/facilities/${facilityId}/elavon`);
}

/**
 * Confirms linking a specific Merchant Account run to this facility --
 * fetches it live from PS, maps, and ingests it, same as a brand-new
 * facility's own Create flow would. 409 (`kind: "error"`) means this
 * facility already has a linked run; re-fetch `getFacilityElavon`
 * rather than retrying.
 */
export async function linkFacilityElavon(
  companyId: string,
  facilityId: string,
  merchantAccountRunId: string
): Promise<ClientsResult<void>> {
  return clientsPost(`/clients/${companyId}/facilities/${facilityId}/elavon/link`, {
    merchant_account_run_id: merchantAccountRunId,
  });
}

/**
 * Removes a facility's Merchant Account link entirely -- e.g. a wrong
 * run got linked (manually, or by automatic correlation at Create time)
 * and the manager needs to link the correct one instead. A fresh
 * `getFacilityElavon` afterward goes back to the unlinked view
 * (candidate suggestion or manual entry), same as a never-linked
 * facility. 404 (`kind: "error"`) means this facility had no linked run
 * to remove.
 */
export async function unlinkFacilityElavon(companyId: string, facilityId: string): Promise<ClientsResult<void>> {
  return clientsDelete(`/clients/${companyId}/facilities/${facilityId}/elavon/link`);
}

/**
 * Refreshes a linked facility's whole Elavon/Merchant Account picture
 * from Process Street -- rate provided, application status,
 * `credentials_added_to_qms`, financials, QMS/pinpad credentials, and
 * parties, all overwritten from a fresh PS pull (2026-09-09; the fix for
 * `credentials_added_to_qms` having no refresh path once the "Add
 * Credentials to QMS" checklist step gets completed after the initial
 * link). 409 (`kind: "error"`) means this facility has no linked
 * Merchant Account run to resync from -- link one first. A fresh
 * `getFacilityElavon` afterward shows the refreshed values.
 */
export async function resyncElavonData(companyId: string, facilityId: string): Promise<ClientsResult<void>> {
  return clientsPost(`/clients/${companyId}/facilities/${facilityId}/elavon/resync`);
}

/** Mirrors `FacilityPerson` -- one already-saved row on the Users tab. */
export interface FacilityPerson {
  person_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  /** "process_street" (an "Add User" chip, or every already-ingested
   * row) or "manual" -- permanently exempt from the Users tab's own
   * self-heal pass. Never shown on "Copy All". */
  source: string;
}

/**
 * Mirrors `PersonAssignment` -- both an "Add User" candidate straight off
 * `clients.ps_person_index` (no `person_id`, since it isn't necessarily
 * linked yet) and the exact shape `addFacilityPerson` below sends back
 * verbatim on a chip click.
 */
export interface PersonAssignment {
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

/** Mirrors `FacilityPeopleResponse`. */
export interface FacilityPeople {
  roster: FacilityPerson[];
  candidates: PersonAssignment[];
}

export async function getFacilityPeople(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<FacilityPeople>> {
  return clientsGet(`/clients/${companyId}/facilities/${facilityId}/people`);
}

/**
 * Adds (or re-adds) a person to this facility's roster. For a
 * `source: "process_street"` add (an "Add User" chip), always an
 * upsert: a person already linked from an old ingest gets their stored
 * name/phone overwritten with `assignment`'s values rather than left
 * alone, the same self-heal `upsert_person_and_link_to_facility`'s own
 * doc comment explains (Sand-Sto's own "Irene Chen - (301) 787-9221").
 * `source: "manual"` is a brand-new person typed in by hand -- never
 * touched by the Users tab's own self-heal pass afterward.
 */
export async function addFacilityPerson(
  companyId: string,
  facilityId: string,
  assignment: PersonAssignment,
  source: "process_street" | "manual"
): Promise<ClientsResult<void>> {
  return clientsPost(`/clients/${companyId}/facilities/${facilityId}/people`, { ...assignment, source });
}

/**
 * The Users tab's "Edit" action -- retypes a roster person's own
 * name/email/phone/role directly. `oldRole` identifies which existing
 * (facility, person, role) link is being edited, since `role` itself
 * may be changing. `protectFromResync` only matters when this person's
 * current `source` is "process_street": true flips their link to
 * "manual" (so this edit survives the Users tab's own self-heal pass
 * going forward); false leaves it "process_street", meaning a future
 * load could still silently revert this edit back to whatever
 * `clients.ps_person_index` says. Ignored (already permanently
 * protected) for an already-"manual" person.
 */
export async function editFacilityPerson(
  companyId: string,
  facilityId: string,
  personId: string,
  oldRole: string,
  assignment: PersonAssignment,
  protectFromResync: boolean
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/people/${personId}`, {
    old_role: oldRole,
    full_name: assignment.full_name,
    email: assignment.email,
    phone: assignment.phone,
    role: assignment.role,
    protect_from_resync: protectFromResync,
  });
}

/**
 * Removes one roster entry -- the same "Add User" chip, shown red once a
 * candidate is already linked, calls this instead of `addFacilityPerson`.
 * Only removes this one (person, role) link; the person's own identity
 * row (and any other facility they're linked to) is untouched.
 */
export async function unlinkFacilityPerson(
  companyId: string,
  facilityId: string,
  personId: string,
  role: string
): Promise<ClientsResult<void>> {
  return clientsDelete(
    `/clients/${companyId}/facilities/${facilityId}/people/${personId}?role=${encodeURIComponent(role)}`
  );
}

/**
 * Changes (or clears, with `null`) which Dropbox folder this facility
 * is linked to -- audit-logged on the backend. The Company page's own
 * "Go to DropBox" launchpad links read the same `dropbox_folder_url`
 * this updates, so they reflect a change here without any extra wiring.
 */
/** Mirrors `ListToolRunsResponse` (unitprep-api/src/api/tool_runs.rs). */
export interface ListToolRunsResponse {
  runs: ToolRunSummary[];
}

/**
 * Onboarding Work tab's own listing -- keyset-paginated on `id`, same
 * `beforeId`/`limit` convention as `listActivityLogs`, so it plugs
 * straight into `useInfiniteLogFeed`.
 */
export async function listFacilityToolRuns(
  companyId: string,
  facilityId: string,
  params: { tool: string; limit?: number; beforeId?: string }
): Promise<ClientsResult<ListToolRunsResponse>> {
  const query = new URLSearchParams({ tool: params.tool });
  if (params.limit) query.set("limit", String(params.limit));
  if (params.beforeId) query.set("before_id", params.beforeId);

  return clientsGet(`/clients/${companyId}/facilities/${facilityId}/tool-runs?${query.toString()}`);
}

/** The download URL for one run's stored output file -- fetched (not
 * navigated to directly) by `useToolRunOutputDownload`, same reasoning
 * as every other authenticated download in this app: a plain `<a href>`
 * would skip the `credentials: "include"` cookie and 401 handling every
 * other fetch here gets. */
export function toolRunOutputUrl(companyId: string, facilityId: string, runId: string): string {
  return `/clients/${companyId}/facilities/${facilityId}/tool-runs/${runId}/output`;
}

/** Same reasoning as `toolRunOutputUrl` -- this run's original source
 * file, stored in the DB independent of Dropbox (see `has_source_file`
 * on `ToolRunSummary`). */
export function toolRunSourceUrl(companyId: string, facilityId: string, runId: string): string {
  return `/clients/${companyId}/facilities/${facilityId}/tool-runs/${runId}/source`;
}

export async function updateFacilityDropboxFolder(
  companyId: string,
  facilityId: string,
  dropboxFolderUrl: string | null
): Promise<ClientsResult<void>> {
  return clientsPut(`/clients/${companyId}/facilities/${facilityId}/dropbox-folder`, {
    dropbox_folder_url: dropboxFolderUrl,
  });
}
