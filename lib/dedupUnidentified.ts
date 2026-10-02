import { clientsPost, type ClientsResult } from "@/lib/clientsApi";
import type { DedupReportView, UnidentifiedMode } from "@/types/api";

/**
 * Re-runs a live Dedup session's check with the user's choice for the
 * tenants that have no customer id ("match by name" or "ignore"), and
 * returns the new report. Also updates the run's stored report on the
 * server, so Onboarding Work shows the same thing.
 */
export function setDedupUnidentifiedMode(
  sessionId: string,
  mode: UnidentifiedMode
): Promise<ClientsResult<{ report: DedupReportView }>> {
  return clientsPost<{ report: DedupReportView }>("/dedup/unidentified", {
    session_id: sessionId,
    mode,
  });
}

/**
 * Re-checks a past run (from Onboarding Work) the same way, using the
 * records the run kept. Needs `client_ops.perform`; fails with a clear
 * message for runs recorded before re-checking was available.
 */
export function rematchToolRun(
  companyId: string,
  facilityId: string,
  runId: string,
  mode: UnidentifiedMode
): Promise<ClientsResult<{ report: DedupReportView }>> {
  return clientsPost<{ report: DedupReportView }>(
    `/clients/${companyId}/facilities/${facilityId}/tool-runs/${runId}/rematch`,
    { mode }
  );
}
