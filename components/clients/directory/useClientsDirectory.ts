"use client";

import { useCallback, useEffect, useState } from "react";

import { archiveCompany, deleteCompany, unarchiveCompany } from "@/lib/clientsCompanies";
import {
  getClientsFilterOptions,
  listClientsDirectory,
  type ClientsFilterOptions,
  type CompanyDirectoryEntry,
} from "@/lib/clientsDirectory";
import { groupByImplementationManager } from "@/lib/groupCompaniesByManager";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useLatestRequest } from "@/lib/useLatestRequest";

// The directory page deliberately does NOT use `useClients()`
// (`lib/clients.tsx`) -- that hook backs the unfiltered full-list cache
// several other consumers (`ClientLayout`, `DiscoveryPage`,
// `DedupUploadPage`, `TaggerUploadPage`, the client-creation flow) still
// rely on, and none of them need search/filtering. Rather than bolt
// query params onto a `useSyncExternalStore` cache built around "one
// full list, fetched once," this hook owns its own fetch/state against
// the directory endpoint. See the approved plan
// (`sparkling-finding-rossum.md`) Frontend section, item 5.

const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Everything the Clients directory page needs: the search box and four
 * multi-select filters, the filtered company list (split into the
 * in-flight / completed / archived sections, grouped by implementation
 * manager), and the archive / unarchive / delete actions.
 */
export function useClientsDirectory() {
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

  const [filterOptions, setFilterOptions] = useState<ClientsFilterOptions | null>(null);
  const [filterOptionsError, setFilterOptionsError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyDirectoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const beginDirectoryRequest = useLatestRequest();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      const result = await getClientsFilterOptions();
      if (result.kind !== "ok") {
        setFilterOptionsError(result.message);
        return;
      }
      setFilterOptionsError(null);
      setFilterOptions(result.data);
    });
  }, []);

  const loadDirectory = useCallback(async () => {
    // A newer filter/search aborts this request; its answer must not land.
    const signal = beginDirectoryRequest();
    const result = await listClientsDirectory({
      q: effectiveQuery || undefined,
      implementationManagerUserIds: selectedManagerIds,
      salesRepUserIds: selectedRepIds,
      states: selectedStates,
      previousPms: selectedPreviousPms,
    }, { signal });
    if (signal.aborted) return;

    if (result.kind !== "ok") {
      setLoadError(result.message);
      setHydrated(true);
      return;
    }

    setLoadError(null);
    setCompanies(result.data);
    setHydrated(true);
  }, [beginDirectoryRequest, effectiveQuery, selectedManagerIds, selectedRepIds, selectedStates, selectedPreviousPms]);

  useEffect(() => {
    // queueMicrotask, not a direct call -- otherwise
    // `react-hooks/set-state-in-effect` flags loadDirectory (a
    // useCallback whose body sets state after its own await) as
    // setState-synchronously-in-an-effect. Same fix
    // `lib/useAuditLogFilterData.ts` already applies to its own
    // effect-triggered fetches.
    queueMicrotask(loadDirectory);
  }, [loadDirectory]);

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

    await loadDirectory();
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

    await loadDirectory();
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
