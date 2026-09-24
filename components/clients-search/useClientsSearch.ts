"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { searchClients, type FacilityMatch, type SearchClientsResponse } from "@/lib/clientsSearch";
import { groupFacilityMatches, matchKey } from "./clientsSearchHelpers";

/**
 * All of the Search page's own data and selection state -- running a
 * search, grouping facility matches into single vs. "Potential
 * Duplicates" rows, tracking which are checked, and building the
 * `/clients/new` selection payload on Next. Extracted out of the page
 * itself so that file is just the JSX composition over what this hook
 * returns.
 */
export function useClientsSearch() {
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

  const selectedCount = selectableMatches.filter((match) => selected[matchKey(match)]).length;
  const allSelected = selectableMatches.length > 0 && selectedCount === selectableMatches.length;

  const toggleOne = (match: FacilityMatch) => {
    if (match.already_imported) return;
    const key = matchKey(match);
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    for (const match of selectableMatches) {
      next[matchKey(match)] = !allSelected;
    }
    setSelected(next);
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

  return {
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
  };
}
