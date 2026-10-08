// A facility policies: fees, taxes, delinquency, coverage, specials.
import { clientsGet, clientsPut, type ClientsResult } from "@/lib/clientsApi";

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
