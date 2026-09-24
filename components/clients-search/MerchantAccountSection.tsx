import type { MerchantAccountMatch } from "@/lib/clientsSearch";
import { StatusCell } from "./StatusCell";
import { displayFacilityName, formatActivity } from "./clientsSearchHelpers";

interface MerchantAccountSectionProps {
  matches: MerchantAccountMatch[];
}

/**
 * The Search page's own "Merchant Account (Elavon) applications" table
 * -- live Elavon application data, searched separately from Facilities
 * (a real client can have one with no matching Intake run found). Pure
 * presentational read of `matches`, extracted verbatim out of the page.
 */
export function MerchantAccountSection({ matches }: MerchantAccountSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">
        Merchant Account (Elavon) applications <span className="text-slate-400">({matches.length})</span>
      </h2>
      <p className="mb-3 text-sm text-slate-400">
        Live Elavon application data, searched separately from Facilities above (a real client can have one with no
        matching Intake run found -- e.g. MSS Jenks, LLC). Visibility only: importing a facility into OO still needs
        its own Intake run, found via the Facilities search above.
      </p>

      {matches.length === 0 ? (
        <p className="text-sm text-slate-400">No Merchant Account name matches.</p>
      ) : (
        <div className="w-full overflow-x-auto rounded border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-6 py-2.5 font-medium">Application</th>
                <th className="px-6 py-2.5 font-medium">Status</th>
                <th className="px-6 py-2.5 font-medium">Last Activity</th>
                <th className="px-6 py-2.5 font-medium">EIN</th>
                <th className="px-6 py-2.5 font-medium">Address</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => (
                <tr
                  key={match.run_id}
                  className={`border-t border-slate-800 ${match.already_linked ? "text-slate-500" : ""}`}
                >
                  <td className="px-6 py-2.5">
                    {displayFacilityName(match.run_name)}
                    {match.already_linked && (
                      <span className="ml-2 text-xs text-slate-500">(already linked to a facility in OO)</span>
                    )}
                    {match.similar_facility_names.length > 0 && (
                      <div className="mt-1 text-xs text-amber-400">
                        ⚠ Similar name to {match.similar_facility_names.map(displayFacilityName).join(", ")} above —
                        make sure you&apos;re looking at the right business before using this run&apos;s id anywhere.
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-2.5 text-slate-400">
                    <StatusCell status={match.status} />
                  </td>
                  <td className="px-6 py-2.5 text-slate-400">{formatActivity(match.updated_at)}</td>
                  <td className="px-6 py-2.5 font-mono text-xs text-slate-400">{match.ein_last_4 ?? "—"}</td>
                  <td className="px-6 py-2.5 text-slate-400">{match.business_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
