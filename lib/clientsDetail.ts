import { clientsGet, clientsPost, type ClientsResult } from "@/lib/clientsApi";

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

export interface TaxesRow {
  sales_tax_applies_raw: string | null;
  sales_tax_rate_raw: string | null;
  rent_tax_applies_raw: string | null;
  rent_tax_rate_raw: string | null;
  rent_tax_applies_to_all_units_raw: string | null;
  other_one_time_taxes_raw: string | null;
  other_recurring_taxes_raw: string | null;
}

export interface DelinquencyStepRow {
  step_order: number;
  step_type: string;
  raw_value: string;
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
  taxes: TaxesRow | null;
  delinquency_steps: DelinquencyStepRow[];
  coverage_tiers: CoverageTierRow[];
  commission: CommissionRow | null;
  specials_raw_text: string | null;
}

export async function getFacilityPolicies(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<FacilityPolicies>> {
  return clientsGet(`/clients/${companyId}/facilities/${facilityId}/policies`);
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

/** Mirrors `ElavonCandidate`. */
export interface ElavonCandidate {
  merchant_account_run_id: string;
  run_name: string;
  updated_at: string;
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
