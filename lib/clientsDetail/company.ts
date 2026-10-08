// The company page: company detail, ClickUp parent/waiver, onboarding summary.
import { clientsDelete, clientsGet, clientsPut, type ClientsResult } from "@/lib/clientsApi";

export interface FacilitySummary {
  id: string;
  name: string;
  dropbox_folder_url: string | null;
  /** The facility's ClickUp onboarding list, if linked. Name/folder/URL
   * are a snapshot taken at link time; only the id is authoritative. */
  clickup_list_id: string | null;
  clickup_list_name: string | null;
  clickup_folder_name: string | null;
  clickup_list_url: string | null;
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

/** One designation of the company's ClickUp parent facility. Names are
 * snapshots from the time, so the history stays readable after a rename
 * or delete. */
export interface ClickUpParentChange {
  from_facility_id: string | null;
  from_facility_name: string | null;
  to_facility_id: string | null;
  to_facility_name: string | null;
  changed_by_name: string | null;
  changed_at: string;
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
  implementation_completed_at: string | null;
  /** The facility whose ClickUp list is the source for ClickUp Copy. */
  clickup_parent_facility_id: string | null;
  /** Set when the company was deliberately created without ClickUp. */
  clickup_waived_at: string | null;
  /** Every parent designation, oldest first. */
  clickup_parent_history: ClickUpParentChange[];
  elavon_active: boolean;
  facilities: FacilitySummary[];
  owners: OwnerInfo[];
}

export async function getCompanyDetail(companyId: string): Promise<ClientsResult<CompanyDetail>> {
  return clientsGet(`/clients/${companyId}`);
}

/** Designates (or, with `null`, clears) the company's ClickUp parent
 * facility. The facility must have a ClickUp list linked. */
export async function setClickUpParent(
  companyId: string,
  facilityId: string | null,
): Promise<ClientsResult<undefined>> {
  return clientsPut(`/clients/${companyId}/clickup-parent`, { facility_id: facilityId });
}

/** Marks the company "no ClickUp project" (or clears that). */
export async function setClickUpWaiver(
  companyId: string,
  waived: boolean,
): Promise<ClientsResult<undefined>> {
  const path = `/clients/${companyId}/clickup-waiver`;
  // The PUT carries no payload -- the path is the whole request.
  return waived ? clientsPut(path, undefined) : clientsDelete(path);
}

/** Mirrors `FacilityOnboardingSummary` (unitprep-api/src/api/clients_onboarding_summary.rs). */
export interface FacilityOnboardingSummary {
  facility_id: string;
  facility_name: string;
  elavon_linked: boolean;
  elavon_next_step: string | null;
  elavon_awaiting_credentials: boolean;
  /** Credentials step done -- the sole definition of "Complete". */
  elavon_complete: boolean;
  duplicate_checks_completed: number;
}

/** Mirrors `OnboardingSummaryResponse`. */
export interface OnboardingSummaryResponse {
  facilities: FacilityOnboardingSummary[];
}

export async function getCompanyOnboardingSummary(
  companyId: string
): Promise<ClientsResult<OnboardingSummaryResponse>> {
  return clientsGet(`/clients/${companyId}/onboarding-summary`);
}
