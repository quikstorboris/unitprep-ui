"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useCurrentUser } from "@/lib/currentUser";

interface NavLink {
  label: string;
  href: string;
  /** Omitted means "every signed-in user" (Clients, Account > Security).
   * Set means "only a caller holding this permission" -- checked against
   * the same `permissions` list the backend resolves, so this can't
   * drift from the real capability matrix the way a hardcoded role name
   * could. */
  permission?: string;
}

// Config-driven on purpose -- the platform vision expects more top-level
// sections later; adding one should mean adding an entry here, not
// restructuring the nav.
//
// Four groups (2026-09-09 restructure): Tools (the day-to-day
// client-ops surfaces), Integrations (admin-only -- see below),
// Administration (system/user administration), Account (this caller's
// own settings). Integrations used to sit alongside Tools' items as a
// flatter set of top-level links; QMS Tags/Activity Logs used to live
// under Administration despite being client-ops tools, not system
// administration -- Boris's call to regroup by "what kind of thing is
// this" rather than "who happens to be able to see it".
const TOOLS_LINKS: NavLink[] = [
  { label: "Clients", href: "/clients" },
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
  {
    // The client-ops operations trail (imports, dedup/Unit Group runs,
    // Process Street syncs) -- distinct from Administration's Security
    // Logs, see that route's own module doc for why they're kept apart.
    label: "Activity Logs",
    href: "/admin/activity-logs",
    permission: "activity_logs.read",
  },
];

// Admin-only (2026-09-09): configuring a third-party integration's own
// credentials/schedule is being treated as system administration, not a
// client operation, unlike every other client-ops write in this app --
// see the `integrations.manage` permission's own migration comment.
// Gating every link here on that one admin-only permission is also what
// makes the whole "Integrations" section itself admin-only below
// (`visibleIntegrationsLinks.length > 0`), with no separate role check
// needed.
const INTEGRATIONS_LINKS: NavLink[] = [
  { label: "Process Street", href: "/integrations/process-street", permission: "integrations.manage" },
  { label: "DropBox", href: "/integrations/dropbox", permission: "integrations.manage" },
];

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
    label: "Security Policies",
    href: "/admin/security-policies",
    permission: "security_policies.manage",
  },
  {
    // The security audit trail (logins, role changes, authorization
    // failures) -- renamed from "Audit Logs" (2026-09-02) once "Activity
    // Logs" (now under Tools) existed as a genuinely separate operations
    // trail, so the two names don't read as the same thing.
    label: "Security Logs",
    href: "/admin/security-logs",
    permission: "audit_logs.read",
  },
];

// Just the one page for now (Authenticator App) -- per Boris's explicit
// scope, more account-level settings are a follow-up, not this pass.
const ACCOUNT_LINKS: NavLink[] = [{ label: "Security", href: "/account/security" }];

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

/** One nav group: an uppercase header plus its list of links, matching
 * Administration's original nested-`<ul>` shape (a `<li>` cannot host
 * another `<li>` directly, only via a nested `<ul>`/`<ol>`). Reused
 * across all four groups now that there's more than one, rather than
 * writing the same header/list markup four times. */
function NavGroup({
  title,
  links,
  pathname,
  className,
}: {
  title: string;
  links: NavLink[];
  pathname: string;
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <li className={className}>
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </p>
      <ul className="flex flex-col gap-1">
        {links.map((link) => (
          <NavItem key={link.href} link={link} active={pathname.startsWith(link.href)} />
        ))}
      </ul>
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
  const visibleToolsLinks = visibleLinks(TOOLS_LINKS, permissions);
  const visibleIntegrationsLinks = visibleLinks(INTEGRATIONS_LINKS, permissions);
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
        <NavGroup title="Tools" links={visibleToolsLinks} pathname={pathname} />
        <NavGroup
          title="Integrations"
          links={visibleIntegrationsLinks}
          pathname={pathname}
          className="mt-3"
        />
        <NavGroup
          title="Administration"
          links={visibleAdminLinks}
          pathname={pathname}
          className="mt-3"
        />
        <NavGroup title="Account" links={ACCOUNT_LINKS} pathname={pathname} className="mt-3" />
      </ul>

      {/* Pinned to the bottom via mt-auto, separate from the routed nav
          items above -- signing out isn't a page to navigate to, it's an
          action, and this is the one persistent spot every (app)-group
          page shares. */}
      {user && (
        <div className="mt-auto border-t border-slate-800 pt-4">
          <p className="mb-2 truncate px-2 text-xs text-slate-500">
            {user.first_name} {user.last_name}
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
