"use client";

import { useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { hasPermission } from "@/lib/auth-session";
import { useCurrentUser } from "@/lib/currentUser";
import InviteUserForm from "./InviteUserForm";
import UsersTable from "./UsersTable";
import { useUsersAdmin } from "./useUsersAdmin";
import { inputClass, linkButtonClass, primaryButtonClass, smallButtonClass } from "./styles";

function inviteLinkFor(token: string): string {
  return `${window.location.origin}/invites/${token}`;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useCurrentUser();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDisabled, setShowDisabled] = useState(false);

  const {
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
  } = useUsersAdmin();

  // Department managers get the page (users.view) but not these: inviting,
  // exporting, and every per-row administrative action stay behind
  // users.manage, which only admins hold.
  const canManageUsers = hasPermission(currentUser, "users.manage");

  const activeUsers = (users ?? []).filter((user) => user.status !== "deactivated");
  const disabledUsers = (users ?? []).filter((user) => user.status === "deactivated");

  const tableProps = {
    currentUserId: currentUser?.user_id,
    pendingUserId,
    availableRoles,
    canManageUsers,
    canManageRoles: hasPermission(currentUser, "users.manage_roles"),
    canManagePermissions: hasPermission(currentUser, "user_permissions.manage"),
    onReissue: handleReissue,
    onRecover: handleRecover,
    onDisable: handleDisable,
    onReactivate: handleReactivate,
    onGrantRole: handleGrantRole,
    onRevokeRole: handleRevokeRole,
  };

  return (
    <RequirePermission permission="users.view">
    <div className="flex-1 p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Users</h1>
          <p className="mt-1 text-sm text-slate-400">
            {canManageUsers
              ? "Invite new users, and recover an account that has lost its only passkey."
              : "See who has access, and grant personal integrations such as ClickUp."}
          </p>
        </div>

        {canManageUsers && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exportingUsers}
            onClick={handleExportUsers}
            className={smallButtonClass}
          >
            {exportingUsers ? "Exporting…" : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm((value) => !value)}
            className={primaryButtonClass}
          >
            {showCreateForm ? "Cancel" : "Invite a user"}
          </button>
        </div>
        )}
      </div>

      {exportError && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {exportError}
        </p>
      )}

      {issued && (
        <div className="mb-6 rounded border border-blue-800 bg-blue-950 p-4">
          <p className="mb-2 text-sm text-blue-200">
            Setup link for <strong>{issued.reissued ? "the reissued" : "the new"}</strong>{" "}
            invite — shown once. Copy it now and deliver it to the user
            yourself; there&apos;s no email integration yet.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteLinkFor(issued.invite_token)}
              onFocus={(event) => event.currentTarget.select()}
              className={`${inputClass} flex-1 font-mono text-xs`}
            />
            <button
              type="button"
              onClick={() =>
                navigator.clipboard.writeText(inviteLinkFor(issued.invite_token))
              }
              className={smallButtonClass}
            >
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className={`${linkButtonClass} mt-2`}
          >
            Dismiss
          </button>
        </div>
      )}

      {canManageUsers && showCreateForm && (
        <InviteUserForm
          availableRoles={availableRoles}
          onSubmit={handleCreateUser}
          onCreated={() => setShowCreateForm(false)}
        />
      )}

      {loadError && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {loadError}
        </p>
      )}

      {rowError && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {rowError}
        </p>
      )}

      {!users ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <UsersTable users={activeUsers} {...tableProps} />

          {/* Disabled accounts are out of the way by default: they are
              not part of day-to-day administration, and a long tail of
              them would push the live users off screen. Still one click
              away -- reactivating one is a real action. */}
          <section className="mt-8" aria-label="Disabled users">
            <button
              type="button"
              aria-expanded={showDisabled}
              onClick={() => setShowDisabled((value) => !value)}
              className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100"
            >
              <span aria-hidden="true">{showDisabled ? "▾" : "▸"}</span>
              Disabled users ({disabledUsers.length})
            </button>

            {showDisabled &&
              (disabledUsers.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No disabled users.</p>
              ) : (
                <div className="mt-3">
                  <UsersTable users={disabledUsers} {...tableProps} />
                </div>
              ))}
          </section>
        </>
      )}
    </div>
    </RequirePermission>
  );
}
