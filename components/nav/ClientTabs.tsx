"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TabItem {
  key: string;
  label: string;
  segment: string;
}

// Config-driven — adding a future tool (e.g. a lease document processor)
// is one entry here, not a nav rewrite. Order here is just display order;
// tools are reachable in any order regardless of position.
const TABS: TabItem[] = [
  { key: "info", label: "Client Info", segment: "info" },
  { key: "dedup", label: "Dedup", segment: "dedup" },
  {
    key: "unit-groups",
    label: "Unit Groups",
    segment: "unit-groups",
  },
];

export default function ClientTabs({
  clientId,
}: {
  clientId: string;
}) {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-800">
      <nav className="flex gap-1 px-8">
        {TABS.map((tab) => {
          const href = `/clients/${clientId}/${tab.segment}`;
          const active = pathname.startsWith(href);

          return (
            <Link
              key={tab.key}
              href={href}
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
