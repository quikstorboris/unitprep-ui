import { tryAuthFetch, type AuthResult } from "@/lib/auth-shared";

/**
 * A user's own ClickUp connection (`unitprep-api`'s `clickup_connection`
 * module). Each Orchestrator user connects their own ClickUp personal API
 * token so ClickUp work is recorded against the person who did it; the
 * token goes to the server once and is never sent back -- every response
 * here carries status and identity only.
 *
 *  - `not_connected`: no token saved.
 *  - `connected`: ClickUp accepted the token the last time it was checked.
 *  - `invalid`: a token is saved but ClickUp rejected it (revoked or
 *    regenerated) -- the user needs to paste a new one.
 */
export type ClickUpStatus = "not_connected" | "connected" | "invalid";

export interface ClickUpConnection {
  status: ClickUpStatus;
  clickup_user_id: string | null;
  clickup_username: string | null;
  last_validated_at: string | null;
  /** Workspaces ClickUp reported on the check this response follows;
   * empty on a plain status read, which makes no ClickUp call. */
  workspace_names: string[];
}

export async function getClickUpConnection(): Promise<AuthResult<ClickUpConnection>> {
  return tryAuthFetch("/integrations/clickup/connection", undefined, "GET");
}

/** Validates `token` against ClickUp and, only if ClickUp accepts it,
 * saves it (replacing any previous one). A rejected token is a 400 and is
 * never stored. */
export async function saveClickUpToken(token: string): Promise<AuthResult<ClickUpConnection>> {
  return tryAuthFetch("/integrations/clickup/token", { token }, "PUT");
}

/** Re-checks the saved token against ClickUp right now. A rejection comes
 * back as a normal 200 with `status: "invalid"`; only an unreachable
 * ClickUp is an error. */
export async function testClickUpConnection(): Promise<AuthResult<ClickUpConnection>> {
  return tryAuthFetch("/integrations/clickup/test", undefined, "POST");
}

/** Removes the saved token. Safe to call when nothing is saved. */
export async function removeClickUpToken(): Promise<AuthResult<ClickUpConnection>> {
  return tryAuthFetch("/integrations/clickup/token", undefined, "DELETE");
}
