"use client";

import { useEffect, useRef, useState } from "react";

import type { Role, RoleInfo, UserSummary } from "@/lib/auth-users";
import { inputClass, linkButtonClass, smallButtonClass } from "./styles";
import { groupByCategory, useUserPermissions } from "./useUserPermissions";

interface PermissionsDialogProps {
  user: UserSummary;
  availableRoles: RoleInfo[] | null;
  isPending: boolean;
  /** Whether the viewer may grant/revoke roles (`users.manage_roles`). */
  canManageRoles: boolean;
  /** Whether the viewer may grant/revoke direct permissions
   * (`user_permissions.manage`). */
  canManagePermissions: boolean;
  onGrantRole: (user: UserSummary, role: Role) => Promise<void>;
  onRevokeRole: (user: UserSummary, role: Role) => void;
  onClose: () => void;
}

/**
 * The Users page's per-user "Permissions" dialog. One place for
 * everything that decides what a user may do, split into sections:
 * **Roles** (the coarse "what kind of employee is this") and then one
 * section per permission category the API offers (today just
 * "Integrations"; more categories appear here without a frontend
 * change, since the grouping is data from `auth.permissions`).
 *
 * Roles used to be edited inline in the table row; they live here now so
 * there is a single access-control surface instead of two. A section the
 * viewer may not edit is simply not rendered.
 */
export default function PermissionsDialog({
  user,
  availableRoles,
  isPending,
  canManageRoles,
  canManagePermissions,
  onGrantRole,
  onRevokeRole,
  onClose,
}: PermissionsDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [roleToAdd, setRoleToAdd] = useState("");

  const { permissions, loadError, pendingKey, toggleError, toggle } = useUserPermissions(
    user.id,
    canManagePermissions
  );

  // Escape closes; focus moves into the dialog so keyboard users land in
  // it rather than behind it.
  useEffect(() => {
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const unheldRoles = (availableRoles ?? []).filter((role) => !user.roles.includes(role.key));
  const selectedRole = unheldRoles.some((role) => role.key === roleToAdd)
    ? roleToAdd
    : (unheldRoles[0]?.key ?? "");

  async function handleAddRole() {
    if (!selectedRole) return;
    await onGrantRole(user, selectedRole);
    setRoleToAdd("");
  }

  const titleId = `permissions-dialog-title-${user.id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded border border-slate-700 bg-slate-900 p-6 shadow-xl focus:outline-none"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-100">
              Permissions
            </h2>
            <p className="text-sm text-slate-400">
              {user.first_name} {user.last_name} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-200"
          >
            ×
          </button>
        </div>

        {canManageRoles && (
          <section className="mb-6" aria-labelledby={`${titleId}-roles`}>
            <h3
              id={`${titleId}-roles`}
              className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Roles
            </h3>

            <div className="flex flex-wrap items-center gap-1">
              {user.roles.length === 0 && (
                <span className="text-sm text-slate-500">No roles.</span>
              )}
              {user.roles.map((roleKey) => (
                <span
                  key={roleKey}
                  className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
                >
                  {availableRoles?.find((role) => role.key === roleKey)?.label ?? roleKey}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onRevokeRole(user, roleKey)}
                    aria-label={`Remove ${roleKey} role`}
                    className="text-slate-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {unheldRoles.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <select
                  aria-label="Role to add"
                  value={selectedRole}
                  onChange={(event) => setRoleToAdd(event.target.value)}
                  className={`${inputClass} py-1 text-sm`}
                >
                  {unheldRoles.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isPending || !selectedRole}
                  onClick={handleAddRole}
                  className={smallButtonClass}
                >
                  Add role
                </button>
              </div>
            )}
          </section>
        )}

        {canManagePermissions && (
          <>
            {loadError && (
              <p role="alert" className="mb-3 text-sm text-red-400">
                {loadError}
              </p>
            )}

            {!permissions && !loadError && (
              <p className="text-sm text-slate-400">Loading permissions…</p>
            )}

            {permissions && permissions.length === 0 && (
              <p className="text-sm text-slate-500">
                There are no individually-grantable permissions yet.
              </p>
            )}

            {permissions &&
              groupByCategory(permissions).map(({ category, permissions: group }) => (
                <section key={category} className="mb-5" aria-label={category}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {category}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {group.map((permission) => (
                      <li key={permission.key}>
                        <label className="flex cursor-pointer items-start gap-3 rounded border border-slate-800 p-3 hover:border-slate-700">
                          <input
                            type="checkbox"
                            checked={permission.granted}
                            disabled={pendingKey !== null}
                            onChange={() => toggle(permission)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block text-sm font-medium text-slate-200">
                              {permission.label}
                            </span>
                            {permission.description && (
                              <span className="block text-xs text-slate-500">
                                {permission.description}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

            {toggleError && (
              <p role="alert" className="mb-3 text-sm text-red-400">
                {toggleError}
              </p>
            )}
          </>
        )}

        <div className="mt-2 flex justify-end">
          <button type="button" onClick={onClose} className={linkButtonClass}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
