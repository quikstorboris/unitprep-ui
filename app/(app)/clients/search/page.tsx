"use client";

import { useState } from "react";
import Link from "next/link";

import {
  searchClients,
  type FacilityMatch,
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
 * (a live PS call, so always current) and person matches (a locally-
 * synced index, only as fresh as the last background sync).
 *
 * Facility matches get a checkbox + "select all" -- per Boris's own
 * call, matching runs across the three workflows into one real
 * facility is done manually by whoever's onboarding the client, not
 * inferred. Person matches are shown for discovery only (they don't
 * carry a facility-level identity of their own); nothing here acts on
 * a selection yet -- this page exists to prove the search itself works
 * before building the import step on top of it.
 */
export default function ClientsSearchPage() {
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

  const matchKey = (match: FacilityMatch) => `${match.workflow}:${match.run_id}`;

  const selectedCount = facilityMatches.filter((match) => selected[matchKey(match)]).length;
  const allSelected = facilityMatches.length > 0 && selectedCount === facilityMatches.length;

  const toggleOne = (match: FacilityMatch) => {
    const key = matchKey(match);
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const match of facilityMatches) {
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

        {result && (
          <div className="mt-8 flex flex-col gap-10">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Facilities <span className="text-slate-400">({facilityMatches.length})</span>
                </h2>
                {selectedCount > 0 && (
                  <span className="text-sm text-slate-400">{selectedCount} selected</span>
                )}
              </div>

              {facilityMatches.length === 0 ? (
                <p className="text-sm text-slate-400">No facility/company name matches.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="w-10 px-4 py-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            aria-label="Select all facility matches"
                          />
                        </th>
                        <th className="px-4 py-2 font-medium">Run name</th>
                        <th className="px-4 py-2 font-medium">Workflow</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facilityMatches.map((match) => (
                        <tr key={matchKey(match)} className="border-t border-slate-800">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={!!selected[matchKey(match)]}
                              onChange={() => toggleOne(match)}
                              aria-label={`Select ${match.run_name}`}
                            />
                          </td>
                          <td className="px-4 py-2">{match.run_name}</td>
                          <td className="px-4 py-2">{workflowLabel(match.workflow)}</td>
                          <td className="px-4 py-2 text-slate-400">{match.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                <div className="overflow-x-auto rounded border border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900 text-slate-400">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Role</th>
                        <th className="px-4 py-2 font-medium">Email</th>
                        <th className="px-4 py-2 font-medium">Phone</th>
                        <th className="px-4 py-2 font-medium">Found on</th>
                        <th className="px-4 py-2 font-medium">Workflow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.person_matches.map((match: PersonMatch) => (
                        <tr
                          key={`${match.workflow}:${match.ps_run_id}:${match.role}:${match.full_name}`}
                          className="border-t border-slate-800"
                        >
                          <td className="px-4 py-2">{match.full_name}</td>
                          <td className="px-4 py-2 text-slate-400">{roleLabel(match.role)}</td>
                          <td className="px-4 py-2 text-slate-400">{match.email ?? "—"}</td>
                          <td className="px-4 py-2 text-slate-400">{match.phone ?? "—"}</td>
                          <td className="px-4 py-2">{match.run_name}</td>
                          <td className="px-4 py-2 text-slate-400">{workflowLabel(match.workflow)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
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
