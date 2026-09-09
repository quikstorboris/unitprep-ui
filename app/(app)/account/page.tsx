"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Account has exactly one section today, Security (see LeftNav.tsx's
 * Account group) -- this bare route only exists for a stale link or
 * bookmark to land on, and sends the caller straight there rather than
 * showing an empty parent page. Same "Redirecting…" convention as
 * RequirePermission's own redirect.
 */
export default function AccountPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account/security");
  }, [router]);

  return (
    <div className="flex-1 p-8">
      <p className="text-sm text-slate-400">Redirecting…</p>
    </div>
  );
}
