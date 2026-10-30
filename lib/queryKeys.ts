/**
 * Every cached read's key, in one place, so an invalidation after a write
 * can name exactly what it changed. Keys nest: invalidating
 * `queryKeys.company(id)` also refreshes that company's facility reads,
 * which is usually what a company-level write wants; use a facility key to
 * refresh one facility only.
 */
export const queryKeys = {
  /** The Clients page's four filter dropdowns' options (staff, states,
   * previous PMs): change rarely, so cached for minutes. */
  clientsFilterOptions: () => ["clients", "filter-options"] as const,

  /** Every cached answer of the Clients directory, whatever its filters;
   * invalidate this after anything that changes the list. */
  clientsDirectoryAll: () => ["clients", "directory"] as const,

  /** The directory for one search/filter combination. */
  clientsDirectory: (filters: unknown) => ["clients", "directory", filters] as const,

  /** Company detail (name, facilities, ClickUp parent, owners, ...). */
  company: (companyId: string) => ["company", companyId] as const,

  /** One facility's own record (General and Dropbox tabs). */
  facility: (companyId: string, facilityId: string) =>
    ["company", companyId, "facility", facilityId, "detail"] as const,

  /** One facility's fee/tax/delinquency/coverage/specials policies. */
  facilityPolicies: (companyId: string, facilityId: string) =>
    ["company", companyId, "facility", facilityId, "policies"] as const,
};
