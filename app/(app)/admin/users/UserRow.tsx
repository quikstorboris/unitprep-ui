"use client";

import { useState } from "react";

import type { Role, RoleInfo, UserSummary } from "@/lib/auth-users";
import {
  dangerButtonClass,
  inputClass,
  linkButtonClass,
  smallButtonClass,
} from "./styles";

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

interface UserRowProps {
  user: UserSummary;
  isSelf: boolean;
  isPending: boolean;
  availableRoles: RoleInfo[] | null;
  onReissue: (user: UserSummary) => void;
  onRecover: (user: UserSummary) => Promise<void>;
  onDisable: (user: UserSummary) => Promise<void>;
  onReactivate: (user: UserSummary) => Promise<void>;
  onGrantRole: (user: UserSummary, role: Role) => Promise<void>;
  onRevokeRole: (user: UserSummary, role: Role) => void;
}

/**
 * One row of the admin Users table. All of the "click to arm, click
 * again to confirm" and role-picker UI state that used to live in the
 * parent page as maps keyed by user id (`confirmingRecoveryFor === user.id`
 * and friends) lives here instead, as plain local booleans -- only one
 * row can ever be the one whose picker/confirmation is open for itself,
 * so there's no reason the parent needs to track it. The confirm flags
 * reset themselves once their own request settles (success or failure),
 * mirroring exactly when the old page-level handlers used to reset them.
 */
export default function UserRow({
  user,
  isSelf,
  isPending,
  availableRoles,
  onReissue,
  onRecover,
  onDisable,
  onReactivate,
  onGrantRole,
  onRevokeRole,
}: UserRowProps) {
  const [confirmingRecovery, setConfirmingRecovery] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [confirmingReactivate, setConfirmingReactivate] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [roleToAdd, setRoleToAdd] = useState("");

  const canReissue =
    user.status === "invited" && user.credential_count === 0;
  // Never on your own row: recovery revokes every live session on the
  // target account, including -- if you could trigger it on yourself --
  // the one you're using right now to click the button. Recovering your
  // own account also makes no sense on its own terms: reaching this page
  // at all means you aren't locked out.
  const canRecover = user.status === "active" && !isSelf;
  // Never on your own row, for the same reason as recovery -- and never
  // on an already-deactivated user, which the backend refuses anyway
  // (set_user_status is still called on a no-op transition otherwise,
  // and the resulting "conflict" error would be a confusing UI dead end
  // when the row already shows deactivated).
  const canDisable = user.status !== "deactivated" && !isSelf;
  // The counterpart to canDisable -- never true at the same time as it,
  // since they're opposite ends of the same status check. No isSelf
  // guard needed: a deactivated account can't be the caller's own
  // (deactivating your own account is already refused server-side), so
  // this can never be reached for isSelf in practice.
  const canReactivate = user.status === "deactivated";

  async function handleRecoverClick() {
    await onRecover(user);
    setConfirmingRecovery(false);
  }

  async function handleDisableClick() {
    await onDisable(user);
    setConfirmingDisable(false);
  }

  async function handleReactivateClick() {
    await onReactivate(user);
    setConfirmingReactivate(false);
  }

  async function handleGrantRoleClick() {
    await onGrantRole(user, roleToAdd);
    setAddingRole(false);
  }

  return (
    <tr className="border-t border-slate-800">
      <td className="px-4 py-2 text-slate-200">
        {user.first_name} {user.last_name}
      </td>
      <td className="px-4 py-2 text-slate-400">{user.email}</td>
      <td className="px-4 py-2 text-slate-400">{user.company}</td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {user.roles.map((roleKey) => (
            <span
              key={roleKey}
              className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
            >
              {availableRoles?.find((r) => r.key === roleKey)?.label ??
                roleKey}
              {/* Self-role-edit is refused server-side (RLS and the
                  handler both), so this is hidden rather than
                  shown-disabled on your own row -- there's nothing it
                  could ever do. */}
              {!isSelf && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onRevokeRole(user, roleKey)}
                  aria-label={`Remove ${roleKey} role`}
                  className="text-slate-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {!isSelf &&
            (addingRole ? (
              <span className="flex items-center gap-1">
                <select
                  value={roleToAdd}
                  onChange={(event) => setRoleToAdd(event.target.value)}
                  className={`${inputClass} py-0.5 text-xs`}
                >
                  {(availableRoles ?? [])
                    .filter((r) => !user.roles.includes(r.key))
                    .map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={isPending || !roleToAdd}
                  onClick={handleGrantRoleClick}
                  className={smallButtonClass}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setAddingRole(false)}
                  className={linkButtonClass}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  const next = (availableRoles ?? []).find(
                    (r) => !user.roles.includes(r.key)
                  );
                  setRoleToAdd(next?.key ?? "");
                  setAddingRole(true);
                }}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                + Add role
              </button>
            ))}
        </div>
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
      <td className="px-4 py-2 text-slate-400">{user.credential_count}</td>
      <td className="px-4 py-2 text-slate-400">
        {user.totp_enrolled ? "Enrolled" : "—"}
      </td>
      <td className="px-4 py-2">
        {canReissue && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => onReissue(user)}
            className={smallButtonClass}
          >
            {isPending ? "Sending…" : "Reissue invite"}
          </button>
        )}

        {canRecover && !confirmingRecovery && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmingRecovery(true)}
            className={dangerButtonClass}
          >
            Recover account
          </button>
        )}

        {canRecover && confirmingRecovery && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Revokes their passkeys, TOTP, and sessions — sure?
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleRecoverClick}
              className={dangerButtonClass}
            >
              {isPending ? "Recovering…" : "Yes, recover"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRecovery(false)}
              className={linkButtonClass}
            >
              Cancel
            </button>
          </div>
        )}

        {canDisable && !confirmingDisable && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmingDisable(true)}
            className={`${dangerButtonClass} ml-2`}
          >
            Disable
          </button>
        )}

        {canDisable && confirmingDisable && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Deactivates this account — sure?
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleDisableClick}
              className={dangerButtonClass}
            >
              {isPending ? "Disabling…" : "Yes, disable"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDisable(false)}
              className={linkButtonClass}
            >
              Cancel
            </button>
          </div>
        )}

        {canReactivate && !confirmingReactivate && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmingReactivate(true)}
            className={smallButtonClass}
          >
            Reactivate
          </button>
        )}

        {canReactivate && confirmingReactivate && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Issues a fresh setup link — sure?
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleReactivateClick}
              className={smallButtonClass}
            >
              {isPending ? "Reactivating…" : "Yes, reactivate"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReactivate(false)}
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
}
