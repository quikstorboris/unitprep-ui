import { clientsGet, clientsPost, type ClientsResult } from "@/lib/clientsApi";

/**
 * The real `clients.companies` list -- backs the unified `/clients`
 * page and `lib/clients.tsx`'s `useClients()` hook.
 */

/** Mirrors `CompanySummary` in `unitprep-api`'s `clients_companies.rs`. */
export interface CompanySummary {
  id: string;
  legal_name: string;
  created_at: string;
  archived_at: string | null;
  facility_names: string[];
}

/** Any authenticated caller -- see the backend module's own doc comment. */
export async function listCompanies(): Promise<ClientsResult<CompanySummary[]>> {
  return clientsGet("/clients");
}

export async function archiveCompany(companyId: string): Promise<ClientsResult<undefined>> {
  return clientsPost(`/clients/${companyId}/archive`);
}

export async function unarchiveCompany(companyId: string): Promise<ClientsResult<undefined>> {
  return clientsPost(`/clients/${companyId}/unarchive`);
}

/**
 * Scoped manual "Re-sync" -- re-pulls this company's own source run plus
 * every one of its facilities' own runs from Process Street right now.
 * Mirrors `unitprep-api`'s `api::clients_resync` module: `previewResync`
 * reports what would happen (and flags any field that's been manually
 * corrected in OO and now conflicts with Process Street's current
 * value) without writing anything; `applyResync` takes the caller's own
 * per-conflict choices and writes.
 */
export interface ResyncConflict {
  entity_type: "company" | "facility";
  entity_id: string;
  entity_label: string;
  field: string;
  current_value: string | null;
  fresh_value: string | null;
}

export interface PreviewResyncResponse {
  safe_update_count: number;
  conflicts: ResyncConflict[];
}

export async function previewResync(companyId: string): Promise<ClientsResult<PreviewResyncResponse>> {
  return clientsPost(`/clients/${companyId}/resync/preview`);
}

export interface ConflictResolution {
  entity_type: "company" | "facility";
  entity_id: string;
  field: string;
  /** `true` overwrites this field from Process Street; `false` (or
   * simply not listing this conflict) keeps the manually-set value. */
  use_fresh: boolean;
}

export interface ApplyResyncResponse {
  updated_count: number;
}

export async function applyResync(
  companyId: string,
  resolutions: ConflictResolution[]
): Promise<ClientsResult<ApplyResyncResponse>> {
  return clientsPost(`/clients/${companyId}/resync/apply`, { resolutions });
}
