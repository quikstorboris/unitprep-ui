import type { SimilarityMatch } from "@/types/api";

interface SimilarGroupsTableProps {
  matches: SimilarityMatch[];
}

export default function SimilarGroupsTable({
  matches,
}: SimilarGroupsTableProps) {
  return (
    <details className="rounded border border-slate-700 p-4">
      <summary className="cursor-pointer text-xl font-semibold">
        Similar Groups ({matches.length})
      </summary>

      <div className="mt-4">
        {matches.length === 0 ? (
          <div className="text-slate-400">
            No similar groups detected.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800">
                  <th className="p-3 text-left">
                    Facility Group
                  </th>

                  <th className="p-3 text-left">
                    Reference Group
                  </th>

                  <th className="p-3 text-left">
                    Similarity
                  </th>

                  <th className="p-3 text-left">
                    Difference
                  </th>
                </tr>
              </thead>

              <tbody>
                {matches.map(
                  (match, index) => (
                    <tr
                      key={`${match.facility_group}-${index}`}
                      className="border-t border-slate-800"
                    >
                      <td className="p-3">
                        {
                          match.facility_group
                        }
                      </td>

                      <td className="p-3">
                        {
                          match.reference_group
                        }
                      </td>

                      <td className="p-3">
                        {(
                          match.similarity *
                          100
                        ).toFixed(1)}
                        %
                      </td>

                      <td className="p-3">
                        {
                          match.difference
                        }
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}
