"use client";

import { useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { useCurrentUser } from "@/lib/currentUser";
import InviteUserForm from "./InviteUserForm";
import UserRow from "./UserRow";
import { useUsersAdmin } from "./useUsersAdmin";
import { inputClass, linkButtonClass, primaryButtonClass, smallButtonClass } from "./styles";

function inviteLinkFor(token: string): string {
  return `${window.location.origin}/invites/${token}`;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useCurrentUser();
  const [showCreateForm, setShowCreateForm] = useState(false);

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

  return (
    <RequirePermission permission="users.manage">
    <div className="flex-1 p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Users</h1>
          <p className="mt-1 text-sm text-slate-400">
            Invite new users, and recover an account that has lost its
            only passkey.
          </p>
        </div>

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

      {showCreateForm && (
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
        <div className="overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Company</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Last active</th>
                <th className="px-4 py-2 font-medium">Passkeys</th>
                <th className="px-4 py-2 font-medium">TOTP</th>
                <th className="px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUser?.user_id}
                  isPending={pendingUserId === user.id}
                  availableRoles={availableRoles}
                  onReissue={handleReissue}
                  onRecover={handleRecover}
                  onDisable={handleDisable}
                  onReactivate={handleReactivate}
                  onGrantRole={handleGrantRole}
                  onRevokeRole={handleRevokeRole}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </RequirePermission>
  );
}
