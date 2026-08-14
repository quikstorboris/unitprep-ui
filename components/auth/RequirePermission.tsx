"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { hasPermission } from "@/lib/auth-session";
import { useCurrentUser } from "@/lib/currentUser";

/**
 * Route-level guard for the Administration pages (Users, Roles, Audit
 * Logs, Security Policies). `unitprep-api` already refuses a caller
 * lacking `permission` on every endpoint these pages call (403 +
 * `authorization_failure`), so this is UX, not the real security
 * boundary -- it exists so a caller who reaches the URL directly
 * (bookmark, typed-in) sees a redirect instead of a page full of failed
 * requests.
 *
 * Permission-based rather than role-based (this replaces the old
 * `RequireAdmin`, which hardcoded `user?.role === "admin"`) -- checking
 * `hasPermission` here is the same question the backend actually asks,
 * so this component doesn't need its own copy of "which roles can see
 * this page" that could drift from the real capability matrix.
 *
 * Deliberately does not re-check `checked` the way `app/(app)/layout.tsx`
 * does: every page under that route group is only ever rendered once its
 * own guard has already resolved `checked && user && user.totp_enrolled`,
 * so `user` is guaranteed non-null here by the time this component
 * mounts at all.
 */
export default function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const allowed = hasPermission(user, permission);

  useEffect(() => {
    if (!allowed) {
      router.replace("/clients");
    }
  }, [allowed, router]);

  if (!allowed) {
    return (
      <div className="flex-1 p-8">
        <p className="text-sm text-slate-400">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
