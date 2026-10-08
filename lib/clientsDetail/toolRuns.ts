// A facility tool-run history and downloads.
import { clientsDelete, clientsGet, type ClientsResult } from "@/lib/clientsApi";
import type { ToolRunSummary } from "@/types/api";

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

/**
 * Deletes one tool run -- the "clear a mistaken run" action (e.g. a
 * Dedup check accidentally run against the wrong facility's data).
 * Requires `client_ops.perform`; permanent, no undo.
 */
export async function deleteToolRun(
  companyId: string,
  facilityId: string,
  runId: string
): Promise<ClientsResult<void>> {
  return clientsDelete(`/clients/${companyId}/facilities/${facilityId}/tool-runs/${runId}`);
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
