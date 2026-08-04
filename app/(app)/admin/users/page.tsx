"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  createInvite,
  listUsers,
  recoverAccount,
  VALID_COMPANIES,
  type InviteIssued,
  type UserSummary,
} from "@/lib/auth";
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
  const [createError, setCreateError] = useState<string | null>(null);

  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  // Separate from pendingUserId (the in-flight network call) -- a row can
  // be awaiting confirmation without anything having been requested yet.
  const [confirmingRecoveryFor, setConfirmingRecoveryFor] = useState<
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

  return (
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

          <div className="grid grid-cols-2 gap-4">
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
                <th className="px-4 py-2 font-medium">Status</th>
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

                return (
                  <tr key={user.id} className="border-t border-slate-800">
                    <td className="px-4 py-2 text-slate-200">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{user.email}</td>
                    <td className="px-4 py-2 text-slate-400">
                      {user.company}
                    </td>
                    <td className="px-4 py-2 text-slate-400">
                      {user.status}
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
  );
}
