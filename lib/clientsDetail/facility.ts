// A facility record and its Dropbox folder.
import { clientsGet, clientsPut, type ClientsResult } from "@/lib/clientsApi";

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
  clickup_list_id: string | null;
  clickup_list_name: string | null;
  clickup_folder_name: string | null;
  clickup_list_url: string | null;
}

export async function getFacilityDetail(
  companyId: string,
  facilityId: string
): Promise<ClientsResult<FacilityDetail>> {
  return clientsGet(`/clients/${companyId}/facilities/${facilityId}`);
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
