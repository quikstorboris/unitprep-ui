import { clientsGet, clientsPost, type ClientsResult } from "@/lib/clientsApi";

/**
 * ClickUp Copy (`unitprep-api`'s `clickup_copy`): copying a comment from a
 * task in another facility's ClickUp list to its counterpart in this
 * facility's list. All three calls are on the **target** facility (the
 * page the person is on); the source facility defaults to the company's
 * designated parent. Needs the per-user `integrations.clickup` permission
 * and runs with the signed-in user's own ClickUp token, so ClickUp shows
 * them as the author.
 */

export type CopyScope = "all" | "corporate" | "facility";

/** A task as the dialog shows it. */
export interface CopyTaskInfo {
  task_id: string;
  name: string;
  parent_id: string | null;
  parent_name: string | null;
  status: string;
  is_finished: boolean;
  /** Opens the task in ClickUp. */
  url: string;
  /** From the task's Corp/Fac field, when it has one. */
  scope: "corporate" | "facility" | null;
}

export interface CopyTargetChoice extends CopyTaskInfo {
  /** 0-1 similarity to the source task. */
  score: number;
}

export interface CopyPairRow {
  /** "Set Up" or "Migration" -- what the dialog groups rows under. */
  phase: string;
  source: CopyTaskInfo;
  /** The suggested counterpart; null is "no match". */
  target: CopyTargetChoice | null;
  alternatives: CopyTargetChoice[];
}

export interface CopyFacilityList {
  facility_id: string;
  facility_name: string;
  list_name: string;
  list_url: string;
}

export interface CopyPairs {
  source: CopyFacilityList;
  target: CopyFacilityList;
  /** The company's main list, named by the pointer comment; null when no
   * parent is designated (no pointer is posted then). */
  parent: CopyFacilityList | null;
  rows: CopyPairRow[];
  /** Every eligible task in the target list, for choosing by hand. */
  target_tasks: CopyTaskInfo[];
}

export interface CopyRowComments {
  /** The source task's latest comment: what the row is prefilled with. */
  source_comment: { text: string; author: string; date_ms: number } | null;
  /** The target task already has a comment that reads the same. */
  already_copied: boolean;
  /** The target task already has the main-list pointer comment. */
  pointer_present: boolean;
}

export interface CopyOutcome {
  ok: boolean;
  message: string | null;
}

export interface CopyPointerOutcome {
  /** `not_applicable`: no parent designated, or the parent's own task. */
  state: "posted" | "already_present" | "not_applicable" | "failed";
  message: string | null;
}

export interface CopyItemResult {
  target_task_id: string;
  comment: CopyOutcome;
  pointer: CopyPointerOutcome;
  /** Whether the task was set to complete. Only present when that was asked
   * for and the comment went through. */
  completed?: CopyOutcome | null;
  /** Which facility's task this was -- set for a copy to several
   * facilities (the client's ClickUp Copy tab), absent in the facility
   * dialog, where the facility is the one on screen. */
  facility_id?: string;
  facility_name?: string;
}

export interface CopyResult {
  results: CopyItemResult[];
  copied: number;
  failed: number;
}

function base(companyId: string, facilityId: string): string {
  return `/clients/${companyId}/facilities/${facilityId}/clickup`;
}

export async function getCopyPairs(
  companyId: string,
  facilityId: string,
  options: { sourceFacilityId?: string | null; scope?: CopyScope } = {}
): Promise<ClientsResult<CopyPairs>> {
  const query = new URLSearchParams();
  if (options.sourceFacilityId) query.set("source_facility_id", options.sourceFacilityId);
  if (options.scope && options.scope !== "all") query.set("scope", options.scope);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return clientsGet(`${base(companyId, facilityId)}/copy-pairs${suffix}`);
}

export async function getCopyComments(
  companyId: string,
  facilityId: string,
  sourceTaskId: string,
  targetTaskId: string,
  sourceFacilityId?: string | null
): Promise<ClientsResult<CopyRowComments>> {
  const query = new URLSearchParams({ source_task_id: sourceTaskId, target_task_id: targetTaskId });
  if (sourceFacilityId) query.set("source_facility_id", sourceFacilityId);
  return clientsGet(`${base(companyId, facilityId)}/copy-comments?${query.toString()}`);
}

/** Posts each (edited) comment on its target task (ending with a "Main
 * tracker task - {source task}" link), plus -- once per target task -- the
 * generic "main task list" pointer. Rows succeed or fail
 * independently. */
export async function copyComments(
  companyId: string,
  facilityId: string,
  items: { target_task_id: string; comment: string; source_task_id: string }[],
  sourceFacilityId?: string | null,
  completeTasks = false
): Promise<ClientsResult<CopyResult>> {
  return clientsPost(`${base(companyId, facilityId)}/copy`, {
    source_facility_id: sourceFacilityId ?? null,
    items,
    complete_tasks: completeTasks,
  });
}
