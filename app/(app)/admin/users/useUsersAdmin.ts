"use client";

import { useEffect, useState } from "react";

import type { AuthResult } from "@/lib/auth-shared";
import {
  createInvite,
  disableUser,
  exportUsersCsv,
  grantRole,
  listRoles,
  listUsers,
  reactivateUser,
  recoverAccount,
  revokeRole,
  type CreateInviteRequest,
  type InviteIssued,
  type Role,
  type RoleInfo,
  type UserSummary,
} from "@/lib/auth-users";
import { downloadBlob } from "@/lib/useSessionAction";

/**
 * All of the admin Users page's data-fetching and mutations -- the page
 * itself, InviteUserForm, and UserRow each just call the piece of this
 * they need, none of them talking to `lib/auth-users` directly. Confirm/
 * role-picker UI state stays out of here on purpose: that's per-row
 * presentation state UserRow now owns locally, not something a mutation
 * needs to know about.
 */
export function useUsersAdmin() {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<RoleInfo[] | null>(
    null
  );

  // Which row (by user id) currently has a request in flight -- disables
  // that row's own action buttons while it settles.
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [issued, setIssued] = useState<InviteIssued | null>(null);

  const [exportingUsers, setExportingUsers] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function loadUsers() {
    const result = await listUsers();
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setUsers(result.data.users);
  }

  async function loadRoles() {
    const result = await listRoles();
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setAvailableRoles(result.data.roles);
  }

  // Deferred via queueMicrotask rather than calling loadUsers directly --
  // same reasoning as TotpEnrollForm's autoStart: the lint rule flags any
  // setState reachable from the effect body's own synchronous execution,
  // even one that only actually runs after an await completes.
  useEffect(() => {
    queueMicrotask(() => {
      loadUsers();
      loadRoles();
    });
  }, []);

  async function handleExportUsers() {
    setExportError(null);
    setExportingUsers(true);
    const result = await exportUsersCsv();
    setExportingUsers(false);

    if (result.kind !== "ok") {
      setExportError(result.message);
      return;
    }

    const blob = await result.response.blob();
    downloadBlob(
      blob,
      result.response.headers.get("Content-Disposition"),
      "unitprep-users.csv"
    );
  }

  /** Backs InviteUserForm's submit -- the form owns the field state and
   * its own validation-error display, this just makes the request, and
   * on success records the invite link and refreshes the table. */
  async function handleCreateUser(
    request: CreateInviteRequest
  ): Promise<AuthResult<InviteIssued>> {
    const result = await createInvite(request);
    if (result.kind === "ok") {
      setIssued(result.data);
      await loadUsers();
    }
    return result;
  }

  async function handleReissue(user: UserSummary) {
    setRowError(null);
    setPendingUserId(user.id);

    const result = await createInvite({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      company: user.company as CreateInviteRequest["company"],
      job_title: user.job_title ?? undefined,
      // Reissue has no role picker of its own, and the backend's reissue
      // path *replaces* the role set with whatever single role is
      // submitted here (see auth_invites.rs) -- so this only resubmits
      // the first role. An invited-but-not-yet-enrolled user who was
      // granted more than one role before ever signing in would lose the
      // others on reissue; edge case worth knowing about, not handled by
      // this form.
      role: user.roles[0],
    });
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    setIssued(result.data);
    await loadUsers();
  }

  async function handleRecover(user: UserSummary) {
    setRowError(null);
    setPendingUserId(user.id);

    const result = await recoverAccount(user.email);
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    setIssued(result.data);
    await loadUsers();
  }

  async function handleDisable(user: UserSummary) {
    setRowError(null);
    setPendingUserId(user.id);

    const result = await disableUser(user.id);
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    await loadUsers();
  }

  async function handleReactivate(user: UserSummary) {
    setRowError(null);
    setPendingUserId(user.id);

    const result = await reactivateUser(user.id);
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    // Same as create/reissue/recover -- a fresh invite token, shown once.
    setIssued(result.data);
    await loadUsers();
  }

  async function handleGrantRole(user: UserSummary, newRole: Role) {
    if (!newRole || user.roles.includes(newRole)) return;

    setRowError(null);
    setPendingUserId(user.id);

    const result = await grantRole(user.id, newRole);
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    await loadUsers();
  }

  async function handleRevokeRole(user: UserSummary, roleToRemove: Role) {
    setRowError(null);
    setPendingUserId(user.id);

    const result = await revokeRole(user.id, roleToRemove);
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    await loadUsers();
  }

  return {
    users,
    loadError,
    availableRoles,
    pendingUserId,
    rowError,
    issued,
    setIssued,
    exportingUsers,
    exportError,
    handleExportUsers,
    handleCreateUser,
    handleReissue,
    handleRecover,
    handleDisable,
    handleReactivate,
    handleGrantRole,
    handleRevokeRole,
  };
}
