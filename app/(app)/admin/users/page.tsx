"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  changeUserRole,
  createInvite,
  disableUser,
  listUsers,
  reactivateUser,
  recoverAccount,
  VALID_COMPANIES,
  VALID_ROLES,
  type InviteIssued,
  type Role,
  type UserSummary,
} from "@/lib/auth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import { useCurrentUser } from "@/lib/currentUser";

const primaryButtonClass =
  "rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

const dangerButtonClass =
  "rounded bg-red-900 px-3 py-1.5 text-xs font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";

const linkButtonClass =
  "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

const smallButtonClass =
  "rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

function inviteLinkFor(token: string): string {
  return `${window.location.origin}/invites/${token}`;
}

// No ESP is wired up anywhere in this system (see AUTHENTICATION.md) --
// there is nothing to push a real alert through yet. This in-app
// indicator is the honest "for now" version: it costs nothing to build
// and needs no new infrastructure, unlike an actual notification, which
// waits on that same deferred ESP/webhook decision.
const DORMANT_THRESHOLD_DAYS = 90;

function daysSince(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

// Scoped to `active` accounts only -- an `invited` user who hasn't
// enrolled yet has never had a session to go quiet on, which is a
// different signal (and already visible via the Reissue action), and a
// `deactivated` account being "dormant" on top of that is moot.
function isDormant(user: UserSummary): boolean {
  return (
    user.status === "active" &&
    user.last_seen_at !== null &&
    daysSince(user.last_seen_at) >= DORMANT_THRESHOLD_DAYS
  );
}

function formatLastActive(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never";
  const days = Math.floor(daysSince(lastSeenAt));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function AdminUsersPage() {
  const { user: currentUser } = useCurrentUser();
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState<(typeof VALID_COMPANIES)[number]>(
    VALID_COMPANIES[0]
  );
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<Role>(VALID_ROLES[0].value);
  const [createError, setCreateError] = useState<string | null>(null);

  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  // Separate from pendingUserId (the in-flight network call) -- a row can
  // be awaiting confirmation without anything having been requested yet.
  const [confirmingRecoveryFor, setConfirmingRecoveryFor] = useState<
    string | null
  >(null);
  // Same "click to arm, click again to confirm" shape as recovery, kept
  // as its own piece of state rather than reusing confirmingRecoveryFor --
  // the two actions are independent and a row could otherwise show both
  // confirmations open from one flag.
  const [confirmingDisableFor, setConfirmingDisableFor] = useState<
    string | null
  >(null);
  // Same shape again, for the same reason -- reactivate is independent of
  // both disable and recovery and could otherwise show more than one row
  // confirmation open at once.
  const [confirmingReactivateFor, setConfirmingReactivateFor] = useState<
    string | null
  >(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [issued, setIssued] = useState<InviteIssued | null>(null);

  async function loadUsers() {
    const result = await listUsers();
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setUsers(result.data.users);
  }

  // Deferred via queueMicrotask rather than calling loadUsers directly --
  // same reasoning as TotpEnrollForm's autoStart: the lint rule flags any
  // setState reachable from the effect body's own synchronous execution,
  // even one that only actually runs after an await completes.
  useEffect(() => {
    queueMicrotask(() => {
      loadUsers();
    });
  }, []);

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    setCreateError(null);

    const trimmedEmail = email.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedEmail || !trimmedFirst || !trimmedLast) return;

    setPendingUserId("__create__");
    const result = await createInvite({
      email: trimmedEmail,
      first_name: trimmedFirst,
      last_name: trimmedLast,
      company,
      job_title: jobTitle.trim() || undefined,
      role,
    });
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setCreateError(result.message);
      return;
    }

    setIssued(result.data);
    setEmail("");
    setFirstName("");
    setLastName("");
    setJobTitle("");
    setRole(VALID_ROLES[0].value);
    setShowCreateForm(false);
    await loadUsers();
  }

  async function handleReissue(user: UserSummary) {
    setRowError(null);
    setPendingUserId(user.id);

    const result = await createInvite({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      company: user.company as (typeof VALID_COMPANIES)[number],
      job_title: user.job_title ?? undefined,
      // Unchanged -- reissue has no role picker of its own; a wrong role
      // assigned before enrolment is fixable by changing it on the row
      // dropdown once reissued (or before, since the backend re-applies
      // whatever role is submitted here too).
      role: user.role,
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
    setConfirmingRecoveryFor(null);

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
    setConfirmingDisableFor(null);

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
    setConfirmingReactivateFor(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    // Same as create/reissue/recover -- a fresh invite token, shown once.
    setIssued(result.data);
    await loadUsers();
  }

  async function handleRoleChange(user: UserSummary, newRole: Role) {
    if (newRole === user.role) return;

    setRowError(null);
    setPendingUserId(user.id);

    const result = await changeUserRole(user.id, newRole);
    setPendingUserId(null);

    if (result.kind !== "ok") {
      setRowError(result.message);
      return;
    }

    await loadUsers();
  }

  return (
    <RequireAdmin>
    <div className="flex-1 p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Users</h1>
          <p className="mt-1 text-sm text-slate-400">
            Invite new users, and recover an account that has lost its
            only passkey.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateError(null);
            setShowCreateForm((value) => !value);
          }}
          className={primaryButtonClass}
        >
          {showCreateForm ? "Cancel" : "Invite a user"}
        </button>
      </div>

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
        <form
          onSubmit={handleCreateSubmit}
          className="mb-6 flex flex-col gap-4 rounded border border-slate-800 bg-slate-900 p-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              First name
              <input
                required
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Last name
              <input
                required
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="name@quikstor.com"
            />
          </label>

          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Company
              <select
                value={company}
                onChange={(event) =>
                  setCompany(
                    event.target.value as (typeof VALID_COMPANIES)[number]
                  )
                }
                className={inputClass}
              >
                {VALID_COMPANIES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className={inputClass}
              >
                {VALID_ROLES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Job title (optional)
              <input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          {createError && (
            <p role="alert" className="text-sm text-red-400">
              {createError}
            </p>
          )}

          <button
            type="submit"
            disabled={
              pendingUserId === "__create__" ||
              !email.trim() ||
              !firstName.trim() ||
              !lastName.trim()
            }
            className={`${primaryButtonClass} self-start`}
          >
            {pendingUserId === "__create__" ? "Sending…" : "Create invite"}
          </button>
        </form>
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
              {users.map((user) => {
                const isPending = pendingUserId === user.id;
                const isSelf = user.id === currentUser?.user_id;
                const canReissue =
                  user.status === "invited" && user.credential_count === 0;
                // Never on your own row: recovery revokes every live
                // session on the target account, including -- if you
                // could trigger it on yourself -- the one you're using
                // right now to click the button. Recovering your own
                // account also makes no sense on its own terms: reaching
                // this page at all means you aren't locked out.
                const canRecover = user.status === "active" && !isSelf;
                // Never on your own row, for the same reason as
                // recovery -- and never on an already-deactivated user,
                // which the backend refuses anyway (set_user_status is
                // still called on a no-op transition otherwise, and the
                // resulting "conflict" error would be a confusing UI
                // dead end when the row already shows deactivated).
                const canDisable = user.status !== "deactivated" && !isSelf;
                // The counterpart to canDisable -- never true at the same
                // time as it, since they're opposite ends of the same
                // status check. No isSelf guard needed: a deactivated
                // account can't be the caller's own (deactivating your own
                // account is already refused server-side), so this can
                // never be reached for isSelf in practice.
                const canReactivate = user.status === "deactivated";

                return (
                  <tr key={user.id} className="border-t border-slate-800">
                    <td className="px-4 py-2 text-slate-200">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{user.email}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {user.company}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={user.role}
                        disabled={isSelf || isPending}
                        onChange={(event) =>
                          handleRoleChange(user, event.target.value as Role)
                        }
                        className={`${inputClass} py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {VALID_ROLES.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      className={
                        user.status === "deactivated"
                          ? "px-4 py-2 text-red-400"
                          : "px-4 py-2 text-slate-400"
                      }
                    >
                      {user.status}
                    </td>
                    <td
                      className={
                        isDormant(user)
                          ? "px-4 py-2 text-amber-400"
                          : "px-4 py-2 text-slate-400"
                      }
                      title={
                        isDormant(user)
                          ? `No activity for ${DORMANT_THRESHOLD_DAYS}+ days`
                          : undefined
                      }
                    >
                      {formatLastActive(user.last_seen_at)}
                      {isDormant(user) && " ⚠"}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {user.credential_count}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {user.totp_enrolled ? "Enrolled" : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {canReissue && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleReissue(user)}
                          className={smallButtonClass}
                        >
                          {isPending ? "Sending…" : "Reissue invite"}
                        </button>
                      )}

                      {canRecover && confirmingRecoveryFor !== user.id && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmingRecoveryFor(user.id)}
                          className={dangerButtonClass}
                        >
                          Recover account
                        </button>
                      )}

                      {canRecover && confirmingRecoveryFor === user.id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            Revokes their passkeys, TOTP, and sessions —
                            sure?
                          </span>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleRecover(user)}
                            className={dangerButtonClass}
                          >
                            {isPending ? "Recovering…" : "Yes, recover"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingRecoveryFor(null)}
                            className={linkButtonClass}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {canDisable && confirmingDisableFor !== user.id && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmingDisableFor(user.id)}
                          className={`${dangerButtonClass} ml-2`}
                        >
                          Disable
                        </button>
                      )}

                      {canDisable && confirmingDisableFor === user.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            Deactivates this account — sure?
                          </span>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleDisable(user)}
                            className={dangerButtonClass}
                          >
                            {isPending ? "Disabling…" : "Yes, disable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDisableFor(null)}
                            className={linkButtonClass}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {canReactivate && confirmingReactivateFor !== user.id && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setConfirmingReactivateFor(user.id)}
                          className={smallButtonClass}
                        >
                          Reactivate
                        </button>
                      )}

                      {canReactivate && confirmingReactivateFor === user.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-400">
                            Issues a fresh setup link — sure?
                          </span>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleReactivate(user)}
                            className={smallButtonClass}
                          >
                            {isPending ? "Reactivating…" : "Yes, reactivate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingReactivateFor(null)}
                            className={linkButtonClass}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {isSelf && !canReissue && (
                        <span className="text-xs text-slate-500">You</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </RequireAdmin>
  );
}
