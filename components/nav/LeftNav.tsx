"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useCurrentUser } from "@/lib/currentUser";

interface NavLink {
  label: string;
  href: string;
  /** Omitted means "every signed-in user" (Clients, Account). Set means
   * "only a caller holding this permission" -- checked against the same
   * `permissions` list the backend resolves, so this can't drift from
   * the real capability matrix the way a hardcoded role name could. */
  permission?: string;
}

// Config-driven on purpose — the platform vision expects more top-level
// sections later; adding one should mean adding an entry here, not
// restructuring the nav. Administration groups everything gated by an
// admin-shaped permission under one heading rather than four flat items
// mixed in with Clients/Account, now that there's enough of them (Users,
// Roles, Audit Logs, Security Policies) for that to matter.
const TOP_LEVEL_LINKS: NavLink[] = [{ label: "Clients", href: "/clients" }];

const ADMINISTRATION_LINKS: NavLink[] = [
  { label: "Users", href: "/admin/users", permission: "users.manage" },
  {
    label: "Roles",
    href: "/admin/roles",
    // Roles is a read-only view of the catalog (see the Roles page's own
    // doc comment) -- gated on users.manage_roles, the capability that
    // actually needs to see it, rather than inventing a new permission
    // for a page with no write actions of its own yet.
    permission: "users.manage_roles",
  },
  {
    label: "Audit Logs",
    href: "/admin/audit-logs",
    permission: "audit_logs.read",
  },
  {
    label: "Security Policies",
    href: "/admin/security-policies",
    permission: "security_policies.manage",
  },
  {
    label: "QMS Tags",
    href: "/admin/client-ops/qms-tags",
    // Not admin-exclusive -- onboarding_manager and department_manager
    // hold client_ops.manage_tags too (Boris's call: maintaining this
    // reference catalog reads as system configuration, not a client
    // operation, so all three client-ops-adjacent roles share it rather
    // than following client_ops.perform's usual admin-excluded shape).
    permission: "client_ops.manage_tags",
  },
];

const ACCOUNT_LINK: NavLink = { label: "Account", href: "/account" };

function visibleLinks(links: NavLink[], permissions: string[]): NavLink[] {
  return links.filter(
    (link) => !link.permission || permissions.includes(link.permission)
  );
}

function NavItem({
  link,
  active,
  className,
}: {
  link: NavLink;
  active: boolean;
  /** For a caller that needs spacing (e.g. `mt-3` before the Account
   * link) -- applied to this component's own `<li>` rather than having
   * the caller wrap it in a second one, which is invalid HTML (`<li>`
   * cannot be a descendant of `<li>` except via a nested `<ul>`/`<ol>`,
   * which is what the Administration group below actually does). */
  className?: string;
}) {
  return (
    <li className={className}>
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-slate-800 text-slate-100"
            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
        }`}
      >
        {link.label}
      </Link>
    </li>
  );
}

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

  const permissions = user?.permissions ?? [];
  const visibleAdminLinks = visibleLinks(ADMINISTRATION_LINKS, permissions);

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-950 p-4">
      <div className="mb-6 h-12 px-2">
        <Image
          src="/orchestrator-logo-dark.svg"
          alt="Orchestrator"
          width={200}
          height={48}
          priority
          style={{ width: "100%", height: "auto" }}
        />
      </div>

      <ul className="flex flex-col gap-1">
        {TOP_LEVEL_LINKS.map((link) => (
          <NavItem
            key={link.href}
            link={link}
            active={pathname.startsWith(link.href)}
          />
        ))}

        {visibleAdminLinks.length > 0 && (
          <li className="mt-3">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Administration
            </p>
            <ul className="flex flex-col gap-1">
              {visibleAdminLinks.map((link) => (
                <NavItem
                  key={link.href}
                  link={link}
                  active={pathname.startsWith(link.href)}
                />
              ))}
            </ul>
          </li>
        )}

        <NavItem
          link={ACCOUNT_LINK}
          active={pathname.startsWith(ACCOUNT_LINK.href)}
          className="mt-3"
        />
      </ul>

      {/* Pinned to the bottom via mt-auto, separate from the routed nav
          items above -- signing out isn't a page to navigate to, it's an
          action, and this is the one persistent spot every (app)-group
          page shares. */}
      {user && (
        <div className="mt-auto border-t border-slate-800 pt-4">
          {/* Shows roles, not a name/email, because WhoAmI doesn't carry
              either -- auth.users has first_name/last_name/email, but
              /auth/whoami never surfaces them. Open product question
              (worth showing a name here? PII-in-an-auth-check-response
              tradeoff?), not a frontend fix. */}
          <p className="mb-2 truncate px-2 text-xs text-slate-500">
            {user.roles.join(", ")}
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
