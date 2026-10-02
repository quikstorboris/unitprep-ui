import { tryAuthFetch, type AuthResult } from "@/lib/auth-shared";
import { clientsDelete, clientsGet, clientsPut, type ClientsResult } from "@/lib/clientsApi";

/**
 * Linking facilities to ClickUp lists -- the API behind the Company
 * page's "Link ClickUp" dialog and the facility General tab's ClickUp
 * button (`unitprep-api`'s `clickup_lookup` and `clients_clickup_links`).
 * Every call runs with the signed-in user's own ClickUp token on the
 * server and needs the per-user `integrations.clickup` permission.
 */

/** One ClickUp list that can be linked, in the onboarding space. */
export interface ClickUpListOption {
  list_id: string;
  list_name: string;
  folder_id: string;
  folder_name: string;
  /** Opens the list in the ClickUp web app. */
  url: string;
}

/** What a facility is linked to now. Name/folder/URL are a snapshot taken
 * when the link was made; only `list_id` is authoritative. */
export interface ClickUpLinkedList {
  list_id: string;
  list_name: string;
  folder_name: string | null;
  url: string;
}

export type MatchConfidence = "high" | "medium" | "low";

export interface ClickUpSuggestion {
  list: ClickUpListOption;
  score: number;
  confidence: MatchConfidence;
}

export interface FacilityClickUpSuggestion {
  facility_id: string;
  facility_name: string;
  current: ClickUpLinkedList | null;
  /** Best match not already claimed by another facility; null when
   * nothing is close enough. */
  suggestion: ClickUpSuggestion | null;
}

export interface SharedList {
  list_id: string;
  list_name: string;
  /** Names of facilities (outside this save) already using the list. */
  also_linked_to: string[];
}

export interface SaveLinksResult {
  linked: number;
  shared_lists: SharedList[];
}

/** Every facility onboarding list, for the per-row dropdown. */
export async function listClickUpLists(): Promise<AuthResult<{ lists: ClickUpListOption[] }>> {
  return tryAuthFetch("/integrations/clickup/lists", undefined, "GET");
}

/** Resolves a ClickUp URL a person pasted to the list it points at, so
 * the dialog can show the list's real name before it counts. Accepts a
 * list URL or the list view URL in the address bar. */
export async function resolveClickUpUrl(url: string): Promise<AuthResult<ClickUpListOption>> {
  return tryAuthFetch("/integrations/clickup/resolve-url", { url }, "POST");
}

export async function getClickUpSuggestions(
  companyId: string
): Promise<ClientsResult<{ facilities: FacilityClickUpSuggestion[] }>> {
  return clientsGet(`/clients/${companyId}/clickup/suggestions`);
}

/** Saves the confirmed links in one all-or-nothing request. The server
 * re-verifies every list with ClickUp and stores what ClickUp reports. */
export async function saveClickUpLinks(
  companyId: string,
  links: { facility_id: string; list_id: string }[]
): Promise<ClientsResult<SaveLinksResult>> {
  return clientsPut(`/clients/${companyId}/clickup/links`, { links });
}

export async function unlinkFacilityClickUp(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<{ unlinked: number }>> {
  return clientsDelete(`/clients/${companyId}/facilities/${facilityId}/clickup-link`);
}

export async function unlinkCompanyClickUp(
  companyId: string
): Promise<ClientsResult<{ unlinked: number }>> {
  return clientsDelete(`/clients/${companyId}/clickup/links`);
}
