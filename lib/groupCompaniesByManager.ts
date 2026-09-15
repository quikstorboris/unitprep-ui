import type { CompanyDirectoryEntry } from "@/lib/clientsDirectory";

export interface ManagerGroup {
  key: string;
  label: string;
  companies: CompanyDirectoryEntry[];
}

/**
 * Groups the Clients directory grid's companies by Implementation
 * Manager -- an "Unassigned" section (sorted last) for companies with
 * none, everything else alphabetical by the manager's name. Split out
 * of `app/(app)/clients/page.tsx` as plain, easily-unit-tested grouping
 * logic, separate from that page's own data-fetching/rendering concern.
 *
 * Never groups by anything Process Street called this concept
 * ("conductor"): the word must not appear anywhere in the UI.
 */
export function groupByImplementationManager(companies: CompanyDirectoryEntry[]): ManagerGroup[] {
  const groups = new Map<string, ManagerGroup>();

  for (const company of companies) {
    const key = company.implementation_manager?.id ?? "unassigned";
    const label = company.implementation_manager?.name ?? "Unassigned";
    const group = groups.get(key) ?? { key, label, companies: [] };
    group.companies.push(company);
    groups.set(key, group);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === "unassigned") return 1;
    if (b.key === "unassigned") return -1;
    return a.label.localeCompare(b.label);
  });
}
