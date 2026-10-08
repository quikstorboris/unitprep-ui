"use client";

export type Tab =
  | "general"
  | "users"
  | "dropbox"
  | "elavon"
  | "fees"
  | "taxes"
  | "delinquency"
  | "coverage"
  | "specials"
  | "onboarding_work";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "users", label: "Users" },
  { key: "dropbox", label: "DropBox" },
  { key: "elavon", label: "Elavon" },
  { key: "fees", label: "Fees" },
  { key: "taxes", label: "Taxes" },
  { key: "delinquency", label: "Delinquency" },
  { key: "coverage", label: "Coverage" },
  { key: "specials", label: "Specials" },
  { key: "onboarding_work", label: "Onboarding Work" },
];

function tabButtonClass(active: boolean) {
  return `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
  }`;
}

export function isTab(value: string | null): value is Tab {
  return TABS.some((t) => t.key === value);
}

/** The facility page's tab buttons (state-driven, unlike the route-driven
 * `nav/ClientTabs` and `nav/CompanyTabs`, which are links). */
export function FacilityTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)} className={tabButtonClass(tab === t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
