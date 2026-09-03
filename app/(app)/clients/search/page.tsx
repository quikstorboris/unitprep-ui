"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/Spinner";
import { ProcessStreetLogo } from "@/components/icons/ProcessStreetLogo";
import {
  searchClients,
  type FacilityMatch,
  type MatchedVia,
  type PersonMatch,
  type PsWorkflow,
  type SearchClientsResponse,
} from "@/lib/clientsSearch";
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
 */

/**
 * Every real PS run title carries this suffix (e.g. "Highway 20 Self
 * Storage - QMS Onboarding") -- the Workflow column already says which
 * PS workflow a row is from, so repeating "Onboarding" in the name
 * itself is redundant. Display-only: the raw `run_name` is still what's
 * sent back on "Add to OO", this never touches the underlying data.
 */
function displayFacilityName(runName: string): string {
  return runName.replace(/ - QMS Onboarding$/i, "");
}

function formatActivity(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * Groups consecutive `facilityMatches` sharing a `run_id` -- the
 * backend already emits a facility's ambiguous Merchant Account
 * candidates as adjacent rows (`clients_search.rs`'s own
 * `facility_matches_for`), so grouping by run of equal `run_id` is
 * enough; no separate id needed to tie them together.
 */
function groupFacilityMatches(matches: FacilityMatch[]): FacilityMatch[][] {
  const groups: FacilityMatch[][] = [];
  for (const match of matches) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup[0].run_id === match.run_id) {
      lastGroup.push(match);
    } else {
      groups.push([match]);
    }
  }
  return groups;
}

export default function ClientsSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchClientsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("Enter a name to search for.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await searchClients(trimmed);

    setLoading(false);

    if (response.kind !== "ok") {
      setError(response.message);
      setResult(null);
      return;
    }

    setResult(response.data);
    setSelected({});
  }

  const facilityMatches = result?.facility_matches ?? [];
  // Already-imported runs are shown (so a manager can see at a glance
  // what's already in OO) but can't be re-selected -- see the vault's
  // "Greyed-out already-imported facilities" note.
  const selectableMatches = facilityMatches.filter((match) => !match.already_imported);

  // Ambiguous Merchant Account candidates render in their own "Potential
  // Duplicates" section, out of the regular table entirely (per Boris,
  // 2026-09-02) -- not just visually distinguished rows within it.
  const facilityGroups = groupFacilityMatches(facilityMatches);
  const singleMatches = facilityGroups.filter((group) => group.length === 1).map((group) => group[0]);
  const duplicateGroups = facilityGroups.filter((group) => group.length > 1);

  // A duplicate candidate shares run_id with its sibling(s) -- disambiguate
  // by which Merchant Account run it came from so each still gets its own
  // checkbox state.
  const matchKey = (match: FacilityMatch) =>
    match.duplicate ? `${match.run_id}:${match.duplicate.merchant_account_run_id}` : match.run_id;

  const selectedCount = selectableMatches.filter((match) => selected[matchKey(match)]).length;
  const allSelected = selectableMatches.length > 0 && selectedCount === selectableMatches.length;

  const toggleOne = (match: FacilityMatch) => {
    if (match.already_imported) return;
    const key = matchKey(match);
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedMatches = selectableMatches.filter((match) => selected[matchKey(match)]);

  function goToConfirmation() {
    // Carries run_name along, not just run_id -- the confirmation
    // screen's preview call needs it to correlate a Merchant Account
    // run before fetching this run's own Intake fields, not after (see
    // lib/clientsImport.ts's own comment on PreviewRunSelection). Also
    // carries which specific Merchant Account run the user picked, when
    // this match came from a "Potential Duplicates" row -- that pick
    // already resolved the ambiguity, so the confirmation screen must
    // never have to (or get to) re-guess it.
    // De-duped by run_id: checking both rows of a "Potential
    // Duplicates" pair selects the same real facility twice, which
    // must still only appear once here.
    const seenRunIds = new Set<string>();
    const selection: Array<{ run_id: string; run_name: string; merchant_account_run_id?: string }> = [];
    for (const match of selectedMatches) {
      if (seenRunIds.has(match.run_id)) continue;
      seenRunIds.add(match.run_id);
      selection.push({
        run_id: match.run_id,
        run_name: match.run_name,
        merchant_account_run_id: match.duplicate?.merchant_account_run_id,
      });
    }
    router.push(`/clients/new?selection=${encodeURIComponent(JSON.stringify(selection))}`);
  }

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const match of selectableMatches) {
      next[matchKey(match)] = !allSelected;
    }
    setSelected(next);
  };

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
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <ProcessStreetLogo className="h-10 w-10" />
            <Spinner className="h-8 w-8 text-blue-400" />
            <p className="text-sm text-slate-400">Fetching data from Process Street…</p>
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
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Facilities <span className="text-slate-400">({facilityMatches.length})</span>
                </h2>
                {selectedCount > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">{selectedCount} selected</span>
                    <button
                      type="button"
                      onClick={goToConfirmation}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {singleMatches.length === 0 ? (
                <p className="text-sm text-slate-400">No facility/company name matches.</p>
              ) : (
                <div className="w-full overflow-x-auto rounded border border-slate-800">
                  {/* w-full here (and on the <table>) so this stretches
                      to match the shared grid column's width -- see the
                      outer grid's own comment for how that width is
                      chosen (still driven by the widest table overall,
                      just resolved one level up now). */}
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="w-10 px-6 py-2.5">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            disabled={selectableMatches.length === 0}
                            aria-label="Select all facility matches"
                          />
                        </th>
                        <th className="px-6 py-2.5 font-medium">Facility</th>
                        <th className="px-6 py-2.5 font-medium">Company</th>
                        <th className="px-6 py-2.5 font-medium">Matched via</th>
                        <th className="px-6 py-2.5 font-medium">Status</th>
                        <th className="px-6 py-2.5 font-medium">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singleMatches.map((match) => (
                        <tr
                          key={matchKey(match)}
                          className={`border-t border-slate-800 ${
                            match.already_imported ? "text-slate-500" : ""
                          }`}
                        >
                          <td className="px-6 py-2.5">
                            <input
                              type="checkbox"
                              checked={!!selected[matchKey(match)]}
                              onChange={() => toggleOne(match)}
                              disabled={match.already_imported}
                              aria-label={`Select ${displayFacilityName(match.run_name)}`}
                            />
                          </td>
                          <td className="px-6 py-2.5">
                            {displayFacilityName(match.run_name)}
                            {match.already_imported && (
                              <span className="ml-2 text-xs text-slate-500">(already in OO)</span>
                            )}
                          </td>
                          <td className="px-6 py-2.5 text-slate-400">{match.company_name ?? "—"}</td>
                          <td className="px-6 py-2.5 text-slate-400">{matchedViaLabel(match.matched_via)}</td>
                          <td className="px-6 py-2.5 text-slate-400">{match.status ?? "—"}</td>
                          <td className="px-6 py-2.5 text-slate-400">{formatActivity(match.last_activity_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {duplicateGroups.length > 0 && (
                <div className="mt-6 flex flex-col gap-4">
                  {duplicateGroups.map((group) => (
                    <div
                      key={group[0].run_id}
                      className="w-full overflow-hidden rounded-lg border-2 border-amber-600 bg-amber-950/10"
                    >
                      <div className="border-b-2 border-amber-600 px-4 py-2 text-sm text-amber-400">
                        ⚠ Potential Duplicates — {displayFacilityName(group[0].run_name)} has {group.length}{" "}
                        candidate Merchant Account matches. Pick the correct one below (or select both), using
                        Merchant Account Updated to judge which is current.
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-amber-200/70">
                            <tr>
                              <th className="w-10 px-4 py-2"></th>
                              <th className="px-4 py-2 font-medium">Facility</th>
                              <th className="px-4 py-2 font-medium">Company</th>
                              <th className="px-4 py-2 font-medium">Matched via</th>
                              <th className="px-4 py-2 font-medium">Status</th>
                              <th className="px-4 py-2 font-medium">Merchant Account Updated</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.map((match) => (
                              <tr key={matchKey(match)} className="border-t border-amber-800/50">
                                <td className="px-4 py-2">
                                  <input
                                    type="checkbox"
                                    checked={!!selected[matchKey(match)]}
                                    onChange={() => toggleOne(match)}
                                    aria-label={`Select ${displayFacilityName(match.run_name)}`}
                                  />
                                </td>
                                <td className="px-4 py-2">{displayFacilityName(match.run_name)}</td>
                                <td className="px-4 py-2 text-slate-300">{match.company_name ?? "—"}</td>
                                <td className="px-4 py-2 text-slate-300">{matchedViaLabel(match.matched_via)}</td>
                                <td className="px-4 py-2 text-slate-300">{match.status ?? "—"}</td>
                                <td className="px-4 py-2 text-slate-300">
                                  {formatActivity(match.duplicate?.merchant_account_updated_at ?? null)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold">
                People <span className="text-slate-400">({result.person_matches.length})</span>
              </h2>

              {result.person_matches.length === 0 ? (
                <p className="text-sm text-slate-400">No person name/email matches.</p>
              ) : (
                <div className="w-full overflow-x-auto rounded border border-slate-800">
                  {/* w-full here too -- see the Facilities table's own
                      comment above. */}
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="px-6 py-2.5 font-medium">Name</th>
                        <th className="px-6 py-2.5 font-medium">Role</th>
                        <th className="px-6 py-2.5 font-medium">Email</th>
                        <th className="px-6 py-2.5 font-medium">Phone</th>
                        <th className="px-6 py-2.5 font-medium">Found on</th>
                        <th className="px-6 py-2.5 font-medium">Workflow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.person_matches.map((match: PersonMatch) => (
                        <tr
                          key={`${match.workflow}:${match.ps_run_id}:${match.role}:${match.full_name}`}
                          className="border-t border-slate-800"
                        >
                          <td className="px-6 py-2.5">{match.full_name}</td>
                          <td className="px-6 py-2.5 text-slate-400">{roleLabel(match.role)}</td>
                          <td className="px-6 py-2.5 text-slate-400">{match.email ?? "—"}</td>
                          <td className="px-6 py-2.5 text-slate-400">{match.phone ?? "—"}</td>
                          <td className="px-6 py-2.5">{displayFacilityName(match.run_name)}</td>
                          <td className="px-6 py-2.5 text-slate-400">{workflowLabel(match.workflow)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
        )}
    </main>
  );
}

function matchedViaLabel(matchedVia: MatchedVia): string {
  switch (matchedVia.kind) {
    case "name":
      return "Facility name";
    case "person":
      return `Person: ${matchedVia.full_name} (${roleLabel(matchedVia.role)})`;
  }
}

function workflowLabel(workflow: PsWorkflow): string {
  switch (workflow) {
    case "intake":
      return "Intake / Progress";
    case "merchant_account":
      return "New Merchant Account";
    case "contract_order":
      return "Contract Order";
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "district_manager":
      return "District Manager";
    case "manager":
      return "Manager";
    case "signer":
      return "Signer";
    case "onboarding_poc":
      return "Onboarding POC";
    case "website_poc":
      return "Website POC";
    case "integration_poc":
      return "Integration POC";
    default:
      return role;
  }
}
