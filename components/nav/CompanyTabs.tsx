"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useClickUpAccess } from "@/components/clickup/useClickUpAccess";

interface TabItem {
  key: string;
  label: string;
  segment: string;
  /** Shown only to users with the per-user ClickUp permission. */
  requiresClickUp?: boolean;
}

// Company-level tabs -- only shown while no facility is selected (see
// the `facilityId` check below). `ClientTabs` covers the other half of
// the tab bar, the facility-scoped tool tabs (Dedup/Unit Groups/
// Template Tagger), which only make sense once a facility is picked.
const TABS: TabItem[] = [
  { key: "general", label: "General", segment: "info" },
  {
    key: "clickup-copy",
    label: "ClickUp Copy",
    segment: "clickup-copy",
    requiresClickUp: true,
  },
  {
    key: "onboarding-summary",
    label: "Onboarding Summary",
    segment: "onboarding-summary",
  },
];

export default function CompanyTabs({
  clientId,
  facilityId,
}: {
  clientId: string;
  /** Defined once a facility is selected -- company tabs don't apply there. */
  facilityId?: string;
}) {
  const pathname = usePathname();
  const clickUp = useClickUpAccess();

  if (facilityId) {
    return null;
  }

  return (
    <div className="border-b border-slate-800">
      <nav className="flex gap-1 px-8">
        {TABS.filter((tab) => !tab.requiresClickUp || clickUp.allowed).map((tab) => {
          const href = `/clients/${clientId}/${tab.segment}`;
          const active = pathname.startsWith(href);

          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "border-blue-500 text-slate-100"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
