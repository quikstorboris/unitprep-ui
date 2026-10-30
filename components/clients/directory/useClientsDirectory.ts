"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { archiveCompany, deleteCompany, unarchiveCompany } from "@/lib/clientsCompanies";
import { getClientsFilterOptions, listClientsDirectory, type CompanyDirectoryEntry } from "@/lib/clientsDirectory";
import { groupByImplementationManager } from "@/lib/groupCompaniesByManager";
import { queryKeys } from "@/lib/queryKeys";
import { queryErrorMessage, unwrap } from "@/lib/queryResult";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

// The directory page deliberately does NOT use `useClients()`
// (`lib/clients.tsx`) -- that hook backs the unfiltered full-list cache
// several other consumers (`DiscoveryPage`, `DedupUploadPage`,
// `TaggerUploadPage`, the client-creation flow) still rely on, and none of
// them need search/filtering. This hook owns its own cached reads against
// the directory endpoint, keyed by the active search and filters.

const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 300;

/** The four dropdowns' options (who the staff are, which states and
 * previous PMs exist) change rarely: fine to reuse for minutes. */
const FILTER_OPTIONS_STALE_MS = 5 * 60_000;

/**
 * Everything the Clients directory page needs: the search box and four
 * multi-select filters, the filtered company list (split into the
 * in-flight / completed / archived sections, grouped by implementation
 * manager), and the archive / unarchive / delete actions.
 *
 * The list is cached per search/filter combination and is always treated as
 * stale (`staleTime: 0`): coming back to the page shows the last answer at
 * once and refreshes it in the background, so a company created, completed
 * or reassigned elsewhere never lingers. While a new filter's answer is on
 * its way the previous list stays up instead of blanking.
 */
export function useClientsDirectory() {
  const queryClient = useQueryClient();

  const [rawSearch, setRawSearch] = useState("");
  const debouncedSearch = useDebouncedValue(rawSearch, SEARCH_DEBOUNCE_MS);
  const trimmedSearch = debouncedSearch.trim();
  // Below the 3-character minimum, this is simply not a search yet --
  // treated the same as an empty box, not as "search for one letter".
  const effectiveQuery = trimmedSearch.length >= SEARCH_MIN_CHARS ? trimmedSearch : "";

  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedPreviousPms, setSelectedPreviousPms] = useState<string[]>([]);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filterOptionsQuery = useQuery({
    queryKey: queryKeys.clientsFilterOptions(),
    queryFn: async () => unwrap(await getClientsFilterOptions()),
    staleTime: FILTER_OPTIONS_STALE_MS,
  });
  const filterOptions = filterOptionsQuery.data ?? null;
  const filterOptionsError = queryErrorMessage(filterOptionsQuery.error);

  const directoryParams = {
    q: effectiveQuery || undefined,
    implementationManagerUserIds: selectedManagerIds,
    salesRepUserIds: selectedRepIds,
    states: selectedStates,
    previousPms: selectedPreviousPms,
  };
  const directoryQuery = useQuery({
    queryKey: queryKeys.clientsDirectory(directoryParams),
    // A newer filter/search cancels this request (the query layer drops its
    // answer), so an older answer can never land over a newer one.
    queryFn: async ({ signal }) => unwrap(await listClientsDirectory(directoryParams, { signal })),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  const companies: CompanyDirectoryEntry[] = directoryQuery.data ?? [];
  // True once the first answer (or failure) is in; never goes back to false
  // while a new filter loads, because the previous list stays up.
  const hydrated = !directoryQuery.isPending;
  const loadError = queryErrorMessage(directoryQuery.error);

  const reloadDirectory = () => queryClient.invalidateQueries({ queryKey: queryKeys.clientsDirectoryAll() });

  const active = companies.filter((company) => !company.archived_at);
  const archived = companies.filter((company) => company.archived_at);
  // An archived company stays in Archived whether or not it was
  // completed; completed only splits the active list.
  const inFlight = active.filter((company) => !company.implementation_completed_at);
  const completed = active.filter((company) => company.implementation_completed_at);

  const hasActiveFilter =
    effectiveQuery !== "" ||
    selectedManagerIds.length > 0 ||
    selectedRepIds.length > 0 ||
    selectedStates.length > 0 ||
    selectedPreviousPms.length > 0;

  const managerOptions = (filterOptions?.staff ?? []).map((user) => ({
    value: user.id,
    label: user.name,
  }));
  // `label`/`value` are the canonical full name so the dropdown reads
  // and filters consistently regardless of how the raw PS data spelled
  // it; `keywords` lets typing the postal abbreviation ("CA") still
  // find it in the dropdown's own search box.
  const stateOptions = (filterOptions?.states ?? []).map((state) => ({
    value: state.name,
    label: state.name,
    keywords: state.abbreviation ? [state.abbreviation] : [],
  }));
  const previousPmsOptions = (filterOptions?.previous_pms ?? []).map((pms) => ({
    value: pms,
    label: pms,
  }));

  async function toggleArchived(id: string, archive: boolean) {
    setActionError(null);
    setPendingId(id);

    const result = archive ? await archiveCompany(id) : await unarchiveCompany(id);

    setPendingId(null);

    if (result.kind !== "ok") {
      setActionError(result.message);
      return;
    }

    await reloadDirectory();
  }

  /** Permanent, not reversible like archive -- confirms in-page first
   * since this is the one destructive action on the directory (see
   * `deleteCompany`'s own doc comment for when this is the right call
   * vs. archiving). */
  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Permanently delete "${name}" and every facility under it? This can't be undone.`)) {
      return;
    }

    setActionError(null);
    setPendingId(id);

    const result = await deleteCompany(id);

    setPendingId(null);

    if (result.kind !== "ok") {
      setActionError(result.message);
      return;
    }

    // The deleted company's own cached pages must not linger either.
    queryClient.removeQueries({ queryKey: queryKeys.company(id) });
    await reloadDirectory();
  }

  return {
    filters: {
      rawSearch,
      setRawSearch,
      selectedManagerIds,
      setSelectedManagerIds,
      selectedRepIds,
      setSelectedRepIds,
      selectedStates,
      setSelectedStates,
      selectedPreviousPms,
      setSelectedPreviousPms,
      managerOptions,
      stateOptions,
      previousPmsOptions,
    },
    filterOptionsError,
    loadError,
    actionError,
    hydrated,
    hasActiveFilter,
    pendingId,
    active,
    archived,
    inFlight,
    completed,
    managerGroups: groupByImplementationManager(inFlight),
    completedGroups: groupByImplementationManager(completed),
    toggleArchived,
    handleDelete,
  };
}

export type ClientsDirectoryFilters = ReturnType<typeof useClientsDirectory>["filters"];
