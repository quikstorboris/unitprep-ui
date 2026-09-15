"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Link from "next/link";

import MultiSelectDropdown from "@/components/shared/MultiSelectDropdown";
import CompanyDirectoryGrid from "@/components/clients/CompanyDirectoryGrid";
import { archiveCompany, deleteCompany, unarchiveCompany } from "@/lib/clientsCompanies";
import {
  getClientsFilterOptions,
  listClientsDirectory,
  type ClientsFilterOptions,
  type CompanyDirectoryEntry,
} from "@/lib/clientsDirectory";
import { groupByImplementationManager } from "@/lib/groupCompaniesByManager";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

// This page deliberately does NOT use `useClients()` (`lib/clients.tsx`)
// -- that hook backs the unfiltered full-list cache several other
// consumers (`ClientLayout`, `DiscoveryPage`, `DedupUploadPage`,
// `TaggerUploadPage`, the client-creation flow) still rely on, and none
// of them need search/filtering. Rather than bolt query params onto a
// `useSyncExternalStore` cache built around "one full list, fetched
// once," this page owns its own fetch/state against the new directory
// endpoint below. See the approved plan (`sparkling-finding-rossum.md`)
// Frontend section, item 5.

const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 300;

const searchInputClass =
  "w-full max-w-md rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none";

const filterControlWidthClass = "w-56";

export default function ClientsPage() {
  const router = useRouter();

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
    const result = await listClientsDirectory({
      q: effectiveQuery || undefined,
      implementationManagerUserIds: selectedManagerIds,
      salesRepUserIds: selectedRepIds,
      states: selectedStates,
      previousPms: selectedPreviousPms,
    });

    if (result.kind !== "ok") {
      setLoadError(result.message);
      setHydrated(true);
      return;
    }

    setLoadError(null);
    setCompanies(result.data);
    setHydrated(true);
  }, [effectiveQuery, selectedManagerIds, selectedRepIds, selectedStates, selectedPreviousPms]);

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
  const managerGroups = groupByImplementationManager(active);

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
   * since this is the one destructive action on this whole page (see
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

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold">Clients</h1>

          <Link
            href="/clients/search"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500"
          >
            Add from Process Street
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <input
            type="text"
            value={rawSearch}
            onChange={(event) => setRawSearch(event.target.value)}
            placeholder="Search by facility name, address, phone, or contact… (3+ characters)"
            className={searchInputClass}
          />

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Implementation Manager
              <MultiSelectDropdown
                options={managerOptions}
                selected={selectedManagerIds}
                onChange={setSelectedManagerIds}
                noun="managers"
                className={filterControlWidthClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Sales Rep
              <MultiSelectDropdown
                options={managerOptions}
                selected={selectedRepIds}
                onChange={setSelectedRepIds}
                noun="reps"
                className={filterControlWidthClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              State
              <MultiSelectDropdown
                options={stateOptions}
                selected={selectedStates}
                onChange={setSelectedStates}
                noun="states"
                className={filterControlWidthClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Previous PMS
              <MultiSelectDropdown
                options={previousPmsOptions}
                selected={selectedPreviousPms}
                onChange={setSelectedPreviousPms}
                noun="PMS values"
                className={filterControlWidthClass}
              />
            </label>
          </div>
        </div>

        {filterOptionsError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {filterOptionsError}
          </p>
        )}

        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {loadError}
          </p>
        )}

        {actionError && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {actionError}
          </p>
        )}

        {!hydrated ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-slate-400">
            {hasActiveFilter
              ? "No matching clients."
              : "No clients yet — click Create to search Process Street and add one."}
          </p>
        ) : (
          <div className="flex flex-col gap-8">
            {managerGroups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-3 text-lg font-semibold text-slate-200">
                  {group.label === "Unassigned" ? "Unassigned" : `Implementation Manager: ${group.label}`}
                </h2>
                <CompanyDirectoryGrid
                  companies={group.companies}
                  pendingId={pendingId}
                  onNavigate={(id) => router.push(`/clients/${id}/info`)}
                  onArchive={(id) => toggleArchived(id, true)}
                  onUnarchive={(id) => toggleArchived(id, false)}
                  onDelete={handleDelete}
                />
              </section>
            ))}
          </div>
        )}

        {hydrated && archived.length > 0 && (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200">
              Archived ({archived.length})
            </summary>

            <div className="mt-3">
              <CompanyDirectoryGrid
                companies={archived}
                pendingId={pendingId}
                onNavigate={(id) => router.push(`/clients/${id}/info`)}
                onArchive={(id) => toggleArchived(id, true)}
                onUnarchive={(id) => toggleArchived(id, false)}
                onDelete={handleDelete}
              />
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
