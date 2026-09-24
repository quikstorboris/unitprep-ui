import { formatPhone } from "@/lib/format";
import type { PersonMatch } from "@/lib/clientsSearch";
import { displayFacilityName, roleLabel, workflowLabel } from "./clientsSearchHelpers";

interface PeopleSectionProps {
  matches: PersonMatch[];
}

/**
 * The Search page's own "People" table -- a locally-synced index, only
 * as fresh as the last background sync, display-only (see the page's
 * own top-level doc comment for the full rationale). Pure presentational
 * read of `matches`, extracted verbatim out of the page.
 */
export function PeopleSection({ matches }: PeopleSectionProps) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">
        People <span className="text-slate-400">({matches.length})</span>
      </h2>

      {matches.length === 0 ? (
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
              {matches.map((match) => (
                <tr
                  key={`${match.workflow}:${match.ps_run_id}:${match.role}:${match.full_name}`}
                  className="border-t border-slate-800"
                >
                  <td className="px-6 py-2.5">{match.full_name}</td>
                  <td className="px-6 py-2.5 text-slate-400">{roleLabel(match.role)}</td>
                  <td className="px-6 py-2.5 text-slate-400">{match.email ?? "—"}</td>
                  <td className="px-6 py-2.5 text-slate-400">{formatPhone(match.phone) || "—"}</td>
                  <td className="px-6 py-2.5">{displayFacilityName(match.run_name)}</td>
                  <td className="px-6 py-2.5 text-slate-400">{workflowLabel(match.workflow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
