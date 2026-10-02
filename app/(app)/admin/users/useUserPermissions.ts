"use client";

import { useEffect, useState } from "react";

import {
  grantUserPermission,
  listUserPermissions,
  revokeUserPermission,
  type GrantablePermission,
} from "@/lib/auth-users";

/**
 * The directly-grantable permissions for one user, as shown in the
 * Add-permissions dialog. Each toggle saves immediately (the API is
 * idempotent, so a checkbox is exactly "make it so"), and every response
 * carries the full resulting state, which replaces local state -- the
 * dialog never has to guess what the server ended up with.
 *
 * Only fetches when `enabled`: a viewer who can edit roles but not
 * permissions opens the same dialog, and must not trigger a request the
 * server would 403.
 */
export function useUserPermissions(userId: string, enabled: boolean) {
  const [permissions, setPermissions] = useState<GrantablePermission[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    queueMicrotask(async () => {
      const result = await listUserPermissions(userId);
      if (cancelled) return;

      if (result.kind !== "ok") {
        setLoadError(result.message);
        return;
      }
      setLoadError(null);
      setPermissions(result.data.permissions);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  async function toggle(permission: GrantablePermission) {
    setToggleError(null);
    setPendingKey(permission.key);

    const result = permission.granted
      ? await revokeUserPermission(userId, permission.key)
      : await grantUserPermission(userId, permission.key);

    setPendingKey(null);

    if (result.kind !== "ok") {
      setToggleError(result.message);
      return;
    }

    setPermissions(result.data.permissions);
  }

  return { permissions, loadError, pendingKey, toggleError, toggle };
}

/** Groups permissions by their API-supplied category, preserving the
 * API's ordering. Uncategorised ones fall under "Other" so nothing the
 * server offers can silently vanish from the dialog. */
export function groupByCategory(
  permissions: GrantablePermission[]
): { category: string; permissions: GrantablePermission[] }[] {
  const groups = new Map<string, GrantablePermission[]>();

  for (const permission of permissions) {
    const category = permission.category ?? "Other";
    groups.set(category, [...(groups.get(category) ?? []), permission]);
  }

  return [...groups.entries()].map(([category, items]) => ({
    category,
    permissions: items,
  }));
}
