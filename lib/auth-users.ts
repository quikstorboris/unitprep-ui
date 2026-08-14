import {
  fetchForDownload,
  tryAuthFetch,
  type AuthResult,
  type FileDownloadResult,
  type Role,
} from "@/lib/auth-shared";

export type { Role };

export interface UserSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  job_title: string | null;
  roles: Role[];
  status: string;
  created_at: string;
  credential_count: number;
  totp_enrolled: boolean;
  /** Most recent activity across every session this user has ever had,
   * or `null` if they've never had one (still `invited`). Backs the
   * admin Users table's dormant-account indicator. */
  last_seen_at: string | null;
}

export async function listUsers(): Promise<
  AuthResult<{ users: UserSummary[] }>
> {
  return tryAuthFetch("/auth/users", undefined, "GET");
}

/** CSV export of every user field the admin Users table shows. */
export async function exportUsersCsv(): Promise<FileDownloadResult> {
  return fetchForDownload("/auth/users/export", undefined, "GET");
}

/** Mirrors `VALID_COMPANIES` in unitprep-api's bootstrap.rs -- the two
 * cannot disagree about what a company is without one of them being
 * silently wrong. */
export const VALID_COMPANIES = ["trojan", "cobre", "quikstor"] as const;

export interface RoleInfo {
  key: string;
  label: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
}

/** The live role catalog straight from `auth.roles` -- replaces a
 * hardcoded frontend role list, which would otherwise need editing every
 * time a role is added, renamed, or (once the custom-role editor exists)
 * created by an admin. Backs both role dropdowns/pickers and the Roles
 * page's capability matrix. */
export async function listRoles(): Promise<AuthResult<{ roles: RoleInfo[] }>> {
  return tryAuthFetch("/auth/roles", undefined, "GET");
}

export interface CreateInviteRequest {
  email: string;
  first_name: string;
  last_name: string;
  company: (typeof VALID_COMPANIES)[number];
  job_title?: string;
  role: Role;
}

export interface InviteIssued {
  user_id: string;
  invite_token: string;
  expires_at: string;
  reissued: boolean;
}

/** Same endpoint creates a brand-new user or reissues for an existing
 * `invited`, zero-credential one -- the backend decides which from the
 * email alone. */
export async function createInvite(
  request: CreateInviteRequest
): Promise<AuthResult<InviteIssued>> {
  return tryAuthFetch<InviteIssued>("/auth/invites", request);
}

/** Revokes every existing access path on the target account (passkeys,
 * TOTP, live sessions, any outstanding invite) and issues a fresh one --
 * for an account that has lost its only passkey. Only valid for a
 * currently `active` account. */
export async function recoverAccount(
  email: string
): Promise<AuthResult<InviteIssued>> {
  return tryAuthFetch<InviteIssued>("/auth/invites/recover", { email });
}

/** The standalone disable-user action -- distinct from `recoverAccount`,
 * which also passes an account through `deactivated` but only as one step
 * of reissuing a lost credential. This is an admin deciding someone should
 * lose access, with nothing reissued afterward. */
export async function disableUser(
  userId: string
): Promise<AuthResult<{ user_id: string; status: string }>> {
  return tryAuthFetch(`/auth/users/${userId}/deactivate`, undefined, "POST");
}

/** The counterpart to `disableUser`, only valid for a currently
 * `deactivated` account. A deactivated account already had every
 * credential wiped at deactivation time, so this can't simply flip status
 * back to `active` -- it goes to `invited` with a fresh invite instead,
 * same destination `recoverAccount` uses and for the same reason. */
export async function reactivateUser(
  userId: string
): Promise<AuthResult<InviteIssued>> {
  return tryAuthFetch<InviteIssued>(
    `/auth/users/${userId}/reactivate`,
    undefined,
    "POST"
  );
}

export interface RoleChangeResult {
  user_id: string;
  roles: Role[];
}

/** Grants an additional role to an already-enrolled user -- distinct from
 * picking a role at invite-creation time (`createInvite`'s `role` field),
 * which only applies to a brand-new or not-yet-enrolled account. Never
 * valid against the caller's own account -- refused both server-side
 * (RLS) and by the backend handler with a clean 400. */
export async function grantRole(
  userId: string,
  role: Role
): Promise<AuthResult<RoleChangeResult>> {
  return tryAuthFetch(`/auth/users/${userId}/roles`, { role }, "POST");
}

/** `grantRole`'s counterpart. Refuses to leave the account with zero
 * roles held only in the same narrow "last active admin" sense the
 * backend already enforces -- otherwise any held role can be revoked
 * freely. */
export async function revokeRole(
  userId: string,
  role: Role
): Promise<AuthResult<RoleChangeResult>> {
  return tryAuthFetch(
    `/auth/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(role)}`,
    undefined,
    "DELETE"
  );
}
