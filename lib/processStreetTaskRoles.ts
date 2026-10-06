import { type SettingsResult, trySettingsFetch } from "@/lib/integrationSettings";

export type { SettingsResult };

/**
 * The Process Street "Task mapping" -- which PS checklist task names each
 * role resolves through (`unitprep-api`'s `clients::ps_task_roles`).
 * Exists because the step that marks Elavon/QMS credentials as in hand
 * was renamed in a PS template change ("Document Credentials", with the
 * old "Add Credentials to QMS" left hidden on new runs); the names are
 * data an admin edits here rather than a string in the code.
 */

/** Mirrors `TaskRoleResponse` in `process_street_task_roles.rs`. */
export interface TaskRole {
  role: string;
  label: string;
  description: string;
  task_names: string[];
  /** Facilities with a synced Merchant Account checklist. */
  facilities_total: number;
  /** Of those, how many show a visible task matching `task_names`. */
  facilities_matched: number;
}

export async function getTaskRoles(): Promise<SettingsResult<{ roles: TaskRole[] }>> {
  return trySettingsFetch("/integrations/process-street/task-roles", undefined, "GET");
}

export async function updateTaskRole(
  role: string,
  taskNames: string[]
): Promise<SettingsResult<TaskRole>> {
  return trySettingsFetch(
    `/integrations/process-street/task-roles/${encodeURIComponent(role)}`,
    { task_names: taskNames },
    "PUT"
  );
}

/** Trims, drops blanks, and removes case-insensitive duplicates (first
 * spelling wins) -- the same normalization the backend applies, so the
 * chips shown are what will actually be saved. */
export function normalizeTaskNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name.length === 0 || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}
