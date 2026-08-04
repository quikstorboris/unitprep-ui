"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useCurrentUser } from "@/lib/currentUser";

interface NavItem {
  label: string;
  href: string;
}

// Config-driven on purpose — the platform vision expects more top-level
// sections later (e.g. Settings); adding one should mean adding an entry
// here, not restructuring the nav.
const NAV_ITEMS: NavItem[] = [
  { label: "Clients", href: "/clients" },
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

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-4">
      <div className="mb-6 px-2 text-lg font-semibold text-slate-100">
        UnitPrep
      </div>

      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
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
