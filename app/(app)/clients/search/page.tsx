"use client";

import Link from "next/link";

import { OrchestratorLoader } from "@/components/OrchestratorLoader";
import { FacilitiesSection } from "@/components/clients-search/FacilitiesSection";
import { MerchantAccountSection } from "@/components/clients-search/MerchantAccountSection";
import { PeopleSection } from "@/components/clients-search/PeopleSection";
import { useClientsSearch } from "@/components/clients-search/useClientsSearch";
import SyncButton from "./SyncButton";

/**
 * Search Process Street for a company/facility/person to import into OO
 * -- Phase 3's entry point (the "Add to OO" action itself isn't wired
 * up yet, see the vault's Process Street Integration notes). Two
 * independent result sets come back in one response: facility matches
 * (some literal PS title hits, some pulled in only via a matching
 * person -- see `matched_via` on each -- since a company name like
 * "Prairie Enterprises" never appears in a facility's own Intake
 * title) and person matches (a locally-synced index, only as fresh as
 * the last background sync).
 *
 * Facility matches get a checkbox + "select all" -- per Boris's own
 * call, matching runs across the three workflows into one real
 * facility is done manually by whoever's onboarding the client, not
 * inferred. Person matches are display-only, discovery-aid rows (they
 * don't carry a facility-level identity of their own, and a person can
 * legitimately appear once per sister facility -- that's a real signal,
 * not noise, see the vault's ps_person_index notes). Checking one or
 * more facilities reveals **Next**, which hands their run ids to
 * `/clients/new` -- the confirmation screen where each selected row
 * gets a Company/Facility role assignment before anything is written.
 *
 * All of the search + selection state and logic lives in
 * `useClientsSearch`; each of the three result tables (Facilities,
 * Merchant Account, People) is its own component under
 * `components/clients-search/` -- this file is just the composition
 * shell wiring them together.
 */
export default function ClientsSearchPage() {
  const {
    query,
    setQuery,
    result,
    loading,
    error,
    runSearch,
    facilityMatches,
    singleMatches,
    duplicateGroups,
    selectableMatches,
    selectedCount,
    allSelected,
    selected,
    toggleOne,
    toggleAll,
    goToConfirmation,
  } = useClientsSearch();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex items-center gap-3">
          <Link href="/clients" className="text-sm text-slate-400 hover:text-slate-200">
            ← Clients
          </Link>
        </div>

        <h1 className="mb-2 text-4xl font-bold">Search Process Street</h1>
        <p className="mb-4 text-sm text-slate-400">
          Find a company, facility, or person already entered in Process Street&apos;s
          Intake, New Merchant Account, or Contract Order workflows.
        </p>

        <div className="mb-8 rounded border border-slate-800 p-4">
          <p className="mb-3 text-sm text-slate-400">
            Person-name search only finds people from the last sync — facility/company
            name search is always live.
          </p>
          <SyncButton />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runSearch();
              }
            }}
            placeholder="Facility, company, or person name"
            className="min-w-72 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />

          <button
            type="button"
            onClick={runSearch}
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}

        {loading && (
          <div className="mt-10">
            <OrchestratorLoader label="Fetching data from Process Street…" />
          </div>
        )}
      </div>

      {!loading && result && (
        // text-center on this OUTER block, not mx-auto on the grid
        // itself -- inline-grid (needed below) is an inline-level box,
        // and margin:auto only centers block-level boxes, so mx-auto on
        // an inline-grid silently does nothing. text-align:center on a
        // normal block parent is the correct way to center an
        // inline-level child. Verified in an isolated browser check
        // before relying on it here, not just assumed from the spec.
        <div className="mt-8 text-center">
          {/* inline-grid (not flex) so every table below shares ONE
              width: a single-column grid's track auto-sizes to its
              widest child's natural content, and every child (default
              justify-items: stretch) then fills that same width -- so
              the Facilities table, each Potential Duplicates box, and
              the People table all end up exactly as wide as whichever
              of them is naturally widest (usually People, with 6 real
              columns), not each sized independently. text-left resets
              the centering above back to normal for everything inside
              (headers, cell content) -- only the block's own position
              should be centered, not its text. */}
          <div className="inline-grid max-w-6xl gap-10 text-left">
            <FacilitiesSection
              facilityMatches={facilityMatches}
              singleMatches={singleMatches}
              duplicateGroups={duplicateGroups}
              selectableCount={selectableMatches.length}
              selectedCount={selectedCount}
              allSelected={allSelected}
              selected={selected}
              onToggleOne={toggleOne}
              onToggleAll={toggleAll}
              onNext={goToConfirmation}
            />

            <MerchantAccountSection matches={result.merchant_account_matches} />

            <PeopleSection matches={result.person_matches} />
          </div>
        </div>
      )}
    </main>
  );
}
