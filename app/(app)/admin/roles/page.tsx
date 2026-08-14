"use client";

import { useEffect, useState } from "react";

import RequirePermission from "@/components/auth/RequirePermission";
import { listRoles, type RoleInfo } from "@/lib/auth-users";

/**
 * Read-only view of the role/permission catalog -- who can do what,
 * today. No editor here: creating custom roles or changing what a role
 * grants is deliberately not built yet (see the vault's roles backlog),
 * so this page is a capability-matrix reference, not a management
 * screen. Assigning an existing role to a user happens on the Users
 * page instead.
 */
export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await listRoles();
      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setRoles(result.data.roles);
    });
  }, []);

  return (
    <RequirePermission permission="users.manage_roles">
      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Roles</h1>
          <p className="mt-1 text-sm text-slate-400">
            What each role can do. Assign a role to a user from the Users
            page.
          </p>
        </div>

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {!roles ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            {roles.map((role) => (
              <div
                key={role.key}
                className="rounded border border-slate-800 bg-slate-900 p-4"
              >
                <div className="mb-1 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-100">
                    {role.label}
                  </h2>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                    {role.key}
                  </span>
                  {role.is_system && (
                    <span
                      className="text-xs text-slate-600"
                      title="A built-in role -- cannot be renamed or deleted."
                    >
                      built-in
                    </span>
                  )}
                </div>

                {role.description && (
                  <p className="mb-3 text-sm text-slate-400">
                    {role.description}
                  </p>
                )}

                {role.permissions.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    No permissions assigned yet.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {role.permissions.map((permission) => (
                      <li
                        key={permission}
                        className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300"
                      >
                        {permission}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
