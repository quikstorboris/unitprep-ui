import type { FacilityMatch } from "@/lib/clientsSearch";
import { StatusCell } from "./StatusCell";
import { displayFacilityName, formatActivity, matchKey, matchedViaLabel } from "./clientsSearchHelpers";

interface FacilitiesSectionProps {
  facilityMatches: FacilityMatch[];
  singleMatches: FacilityMatch[];
  duplicateGroups: FacilityMatch[][];
  selectableCount: number;
  selectedCount: number;
  allSelected: boolean;
  selected: Record<string, boolean>;
  onToggleOne: (match: FacilityMatch) => void;
  onToggleAll: () => void;
  onNext: () => void;
}

/**
 * The Search page's own "Facilities" table -- single matches in the
 * regular table, ambiguous Merchant Account candidates broken out into
 * their own "Potential Duplicates" boxes entirely (per Boris,
 * 2026-09-02). Extracted verbatim out of the page, which still owns all
 * of the selection state.
 */
export function FacilitiesSection({
  facilityMatches,
  singleMatches,
  duplicateGroups,
  selectableCount,
  selectedCount,
  allSelected,
  selected,
  onToggleOne,
  onToggleAll,
  onNext,
}: FacilitiesSectionProps) {
  return (
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
              onClick={onNext}
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
                    onChange={onToggleAll}
                    disabled={selectableCount === 0}
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
                  className={`border-t border-slate-800 ${match.already_imported ? "text-slate-500" : ""}`}
                >
                  <td className="px-6 py-2.5">
                    <input
                      type="checkbox"
                      checked={!!selected[matchKey(match)]}
                      onChange={() => onToggleOne(match)}
                      disabled={match.already_imported}
                      aria-label={`Select ${displayFacilityName(match.run_name)}`}
                    />
                  </td>
                  <td className="px-6 py-2.5">
                    {displayFacilityName(match.run_name)}
                    {match.already_imported && <span className="ml-2 text-xs text-slate-500">(already in OO)</span>}
                  </td>
                  <td className="px-6 py-2.5 text-slate-400">{match.company_name ?? "—"}</td>
                  <td className="px-6 py-2.5 text-slate-400">{matchedViaLabel(match.matched_via)}</td>
                  <td className="px-6 py-2.5 text-slate-400">
                    <StatusCell status={match.status} />
                  </td>
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
                ⚠ Potential Duplicates — {displayFacilityName(group[0].run_name)} has {group.length} candidate
                Merchant Account matches. Pick the correct one below (or select both), using EIN/Address to check
                whether these are really the same business.
                {group[0].duplicate?.addresses_agree === false && (
                  <span className="ml-1 font-medium">Their addresses don&apos;t match — these may be two different businesses.</span>
                )}
                {group[0].duplicate?.addresses_agree === true && (
                  <span className="ml-1 text-amber-300/70">
                    Their addresses match — likely the same application submitted more than once.
                  </span>
                )}
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
                      <th className="px-4 py-2 font-medium">EIN</th>
                      <th className="px-4 py-2 font-medium">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((match) => (
                      <tr key={matchKey(match)} className="border-t border-amber-800/50">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={!!selected[matchKey(match)]}
                            onChange={() => onToggleOne(match)}
                            aria-label={`Select ${displayFacilityName(match.run_name)}`}
                          />
                        </td>
                        <td className="px-4 py-2">{displayFacilityName(match.run_name)}</td>
                        <td className="px-4 py-2 text-slate-300">{match.company_name ?? "—"}</td>
                        <td className="px-4 py-2 text-slate-300">{matchedViaLabel(match.matched_via)}</td>
                        <td className="px-4 py-2 text-slate-300">
                          <StatusCell status={match.status} />
                        </td>
                        <td className="px-4 py-2 text-slate-300">
                          {formatActivity(match.duplicate?.merchant_account_updated_at ?? null)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-300">
                          {match.duplicate?.ein_last_4 ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-300">{match.duplicate?.business_address ?? "—"}</td>
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
  );
}
