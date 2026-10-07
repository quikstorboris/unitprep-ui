import { clientsGet, clientsPost, type ClientsResult } from "@/lib/clientsApi";
import type {
  CopyFacilityList,
  CopyItemResult,
  CopyScope,
  CopyTargetChoice,
  CopyTaskInfo,
} from "@/lib/clickupCopy";

/**
 * ClickUp Copy on the client page: one comment copied from a task in a
 * source facility's list to the counterpart task in several other
 * facilities' lists (`unitprep-api`'s `clickup_copy::bulk`). A copy that
 * fits in ClickUp's rate limit finishes inside the request; a bigger one
 * runs as a background job that is polled (`getCopyJob`). Needs the
 * per-user `integrations.clickup` permission; runs on the signed-in
 * user's own ClickUp token.
 */

/** A source task offered for copying, with its phase. */
export interface BulkTask extends CopyTaskInfo {
  phase: string;
}

export interface FacilityRef {
  facility_id: string;
  facility_name: string;
}

export interface BulkTasks {
  source: CopyFacilityList;
  /** The company's main list, named by the pointer comment. */
  parent: CopyFacilityList | null;
  tasks: BulkTask[];
  /** Facilities the comment can be copied to. */
  destinations: FacilityRef[];
  /** Facilities with no ClickUp list linked yet, so not offered. */
  unlinked: FacilityRef[];
}

/** One destination facility's suggested counterpart of the source task. */
export interface DestinationPairs {
  facility_id: string;
  facility_name: string;
  list_name: string;
  list_url: string;
  /** null is "no match". */
  target: CopyTargetChoice | null;
  alternatives: CopyTargetChoice[];
  /** Every eligible task in this facility's list, to choose by hand. */
  tasks: CopyTaskInfo[];
  /** Why this facility's list could not be read, when it could not. */
  error: string | null;
}

export interface BulkPairs {
  destinations: DestinationPairs[];
}

export interface BulkComment {
  source_comment: { text: string; author: string; date_ms: number } | null;
}

export interface BulkCopyResult {
  /** `inline`: finished, `results` are in. `job`: running in the
   * background -- follow `job_id`. */
  mode: "inline" | "job";
  job_id: string | null;
  total: number;
  results: CopyItemResult[];
  copied: number;
  failed: number;
}

export type CopyJobStatus = "running" | "done" | "failed" | "interrupted";

export interface CopyJob {
  id: string;
  status: CopyJobStatus;
  source_task_name: string;
  total: number;
  copied: number;
  failed: number;
  /** One entry per destination finished so far. */
  results: CopyItemResult[];
  message: string | null;
  created_at: string;
  finished_at: string | null;
}

function base(companyId: string): string {
  return `/clients/${companyId}/clickup`;
}

function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.size > 0 ? `?${search.toString()}` : "";
}

export async function getBulkTasks(
  companyId: string,
  options: { sourceFacilityId?: string | null; scope?: CopyScope } = {}
): Promise<ClientsResult<BulkTasks>> {
  return clientsGet(
    `${base(companyId)}/bulk-tasks${query({
      source_facility_id: options.sourceFacilityId,
      scope: options.scope && options.scope !== "all" ? options.scope : null,
    })}`
  );
}

export async function getBulkPairs(
  companyId: string,
  sourceTaskId: string,
  options: { sourceFacilityId?: string | null; scope?: CopyScope } = {}
): Promise<ClientsResult<BulkPairs>> {
  return clientsGet(
    `${base(companyId)}/bulk-pairs${query({
      source_task_id: sourceTaskId,
      source_facility_id: options.sourceFacilityId,
      scope: options.scope && options.scope !== "all" ? options.scope : null,
    })}`
  );
}

export async function getBulkComment(
  companyId: string,
  sourceTaskId: string,
  sourceFacilityId?: string | null
): Promise<ClientsResult<BulkComment>> {
  return clientsGet(
    `${base(companyId)}/bulk-comment${query({
      source_task_id: sourceTaskId,
      source_facility_id: sourceFacilityId,
    })}`
  );
}

/** Posts one comment to each destination's task (ending with a "Main
 * tracker task - {source task}" link), plus -- once per task -- the "main
 * task list" pointer. Rows succeed or fail independently. */
export async function bulkCopy(
  companyId: string,
  request: {
    sourceFacilityId?: string | null;
    sourceTaskId: string;
    sourceTaskName: string;
    comment: string;
    destinations: { facility_id: string; target_task_id: string }[];
    /** Also set each task to its list's complete status. Off by default. */
    completeTasks?: boolean;
  }
): Promise<ClientsResult<BulkCopyResult>> {
  return clientsPost(`${base(companyId)}/bulk-copy`, {
    source_facility_id: request.sourceFacilityId ?? null,
    source_task_id: request.sourceTaskId,
    source_task_name: request.sourceTaskName,
    comment: request.comment,
    destinations: request.destinations,
    complete_tasks: request.completeTasks ?? false,
  });
}

/** The signed-in user's recent copy jobs for this client, newest first. */
export async function listCopyJobs(companyId: string): Promise<ClientsResult<CopyJob[]>> {
  return clientsGet(`${base(companyId)}/copy-jobs`);
}

export async function getCopyJob(companyId: string, jobId: string): Promise<ClientsResult<CopyJob>> {
  return clientsGet(`${base(companyId)}/copy-jobs/${jobId}`);
}
