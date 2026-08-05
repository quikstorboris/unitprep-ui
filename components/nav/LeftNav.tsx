"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useCurrentUser } from "@/lib/currentUser";

interface NavItem {
  label: string;
  href: string;
  adminOnly?: boolean;
}

// Config-driven on purpose — the platform vision expects more top-level
// sections later (e.g. Settings); adding one should mean adding an entry
// here, not restructuring the nav. `adminOnly` exists because `Role` now
// has a second variant (`onboarding_manager`) that carries no admin
// capability at all -- every route these two items point at 403s for it
// server-side already, so hiding them here is purely UX, not the actual
// security boundary (see unitprep-api's `insufficient_role`).
const NAV_ITEMS: NavItem[] = [
  { label: "Clients", href: "/clients" },
  { label: "Users", href: "/admin/users", adminOnly: true },
  { label: "Audit Logs", href: "/admin/audit-logs", adminOnly: true },
  { label: "Account", href: "/account" },
];

export default function LeftNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-4">
      <div className="mb-6 px-2 text-lg font-semibold text-slate-100">
        UnitPrep
      </div>

      <ul className="flex flex-col gap-1">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(
            item.href
          );

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Pinned to the bottom via mt-auto, separate from the routed nav
          items above -- signing out isn't a page to navigate to, it's an
          action, and this is the one persistent spot every (app)-group
          page shares. */}
      {user && (
        <div className="mt-auto border-t border-slate-800 pt-4">
          <p className="mb-2 truncate px-2 text-xs text-slate-500">
            {user.role}
          </p>
          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
            className="w-full rounded px-3 py-2 text-left text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </nav>
  );
}
