"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useCurrentUser } from "@/lib/currentUser";

/**
 * Route-level guard for the admin-only pages (Users, Audit Logs).
 * `unitprep-api` already refuses `onboarding_manager` on every endpoint
 * these pages call (403 + `authorization_failure`), so this is UX, not
 * the real security boundary -- it exists so a non-admin who reaches the
 * URL directly (bookmark, typed-in) sees a redirect instead of a page
 * full of failed requests.
 *
 * Deliberately does not re-check `checked` the way `app/(app)/layout.tsx`
 * does: every page under that route group is only ever rendered once its
 * own guard has already resolved `checked && user && user.totp_enrolled`,
 * so `user` is guaranteed non-null here by the time this component
 * mounts at all.
 */
export default function RequireAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      router.replace("/clients");
    }
  }, [isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="flex-1 p-8">
        <p className="text-sm text-slate-400">Redirecting…</p>
      </div>
    );
  }

  return <>{children}</>;
}
