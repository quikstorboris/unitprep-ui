"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

// Config-driven on purpose — the platform vision expects more top-level
// sections later (e.g. Settings); adding one should mean adding an entry
// here, not restructuring the nav.
const NAV_ITEMS: NavItem[] = [
  { label: "Clients", href: "/clients" },
];

export default function LeftNav() {
  const pathname = usePathname();

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
    </nav>
  );
}
