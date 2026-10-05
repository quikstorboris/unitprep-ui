import { clientsGet, clientsPost, type ClientsResult } from "@/lib/clientsApi";

/**
 * Posting a finished duplicate check to the facility's ClickUp task
 * (`unitprep-api`'s `clickup_duplicate_check`). The server works out
 * which check this is and where its file was saved from the run itself;
 * the browser only names the session and, to update, the task the person
 * confirmed. Needs the per-user `integrations.clickup` permission and
 * runs with the signed-in user's own ClickUp token.
 */

/** A task in the facility's ClickUp list that could be this check's. */
export interface DuplicateCheckTaskCandidate {
  task_id: string;
  name: string;
  /** The task's parent, when it is a subtask -- the same step name
   * repeats under several parents in a real list. */
  parent_name: string | null;
  status: string;
  is_finished: boolean;
  assignees: string[];
  /** Opens the task in ClickUp. */
  url: string;
  /** 0-1 similarity to the step's task names. */
  score: number;
}

export interface DuplicateCheckTasks {
  /** "1st Duplicate Check", "2nd Duplicate Check", ... */
  step_label: string;
  sequence_number: number;
  list_name: string;
  list_url: string;
  /** Whether the summary file is saved in Dropbox, so the comment can
   * link it. When false the comment has no link. */
  file_link_available: boolean;
  /** Third and later checks only add a comment to the task. */
  comment_only: boolean;
  candidates: DuplicateCheckTaskCandidate[];
}

/** How one of the three ClickUp writes went. */
export interface StepOutcome {
  ok: boolean;
  message: string | null;
}

export interface PostedDuplicateCheck {
  task_name: string;
  task_url: string;
  /** What the comment links: a Dropbox share link, the file's plain
   * Dropbox path (Dropbox would not make a share link), or nothing (no
   * Dropbox file -- the person adds it by hand). */
  link_kind: "shared" | "path" | "none";
  comment: StepOutcome;
  /** Null when not part of this update (third and later checks). */
  assignee: StepOutcome | null;
  status: StepOutcome | null;
}

export async function getDuplicateCheckTasks(
  companyId: string,
  facilityId: string,
  sessionId: string
): Promise<ClientsResult<DuplicateCheckTasks>> {
  return clientsGet(
    `/clients/${companyId}/facilities/${facilityId}/clickup/duplicate-check-tasks?session_id=${encodeURIComponent(sessionId)}`
  );
}

/** Comments on the task with a link to the saved file, adds the signed-in
 * user as assignee and sets the task complete. The three writes are
 * separate ClickUp calls, so each reports its own outcome. */
export async function postDuplicateCheckResults(
  companyId: string,
  facilityId: string,
  sessionId: string,
  taskId: string
): Promise<ClientsResult<PostedDuplicateCheck>> {
  return clientsPost(`/clients/${companyId}/facilities/${facilityId}/clickup/duplicate-check-results`, {
    session_id: sessionId,
    task_id: taskId,
  });
}

/** Asks the server to start reading the facility's ClickUp task list in
 * the background so the panel's lookup is instant later. Fire and forget:
 * it answers at once, and any failure is harmless (the lookup then loads
 * the list itself). */
export async function prefetchDuplicateCheckTasks(companyId: string, facilityId: string): Promise<void> {
  await clientsPost(`/clients/${companyId}/facilities/${facilityId}/clickup/prefetch-tasks`);
}
