import { formatUnits } from "@/lib/format";
import type { TypoVariantView } from "@/types/api";

interface TypoVariantsSectionProps {
  candidates: TypoVariantView[];
}

export default function TypoVariantsSection({
  candidates,
}: TypoVariantsSectionProps) {
  return (
    <details className="rounded border border-slate-700 p-4">
      <summary className="cursor-pointer text-xl font-semibold">
        Possible Name/Typo Variants (
        {candidates.length})
      </summary>

      <div className="mt-4">
        {candidates.length === 0 ? (
          <div className="text-slate-400">
            No typo/name variant
            candidates detected.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800">
                  <th className="p-3 text-left">
                    Tenant A
                  </th>

                  <th className="p-3 text-left">
                    Tenant B
                  </th>

                  <th className="p-3 text-left">
                    Contact Info
                  </th>

                  <th className="p-3 text-left">
                    Note
                  </th>
                </tr>
              </thead>

              <tbody>
                {candidates.map(
                  (candidate, index) => (
                    <tr
                      key={`${candidate.display_name_a}-${candidate.display_name_b}-${index}`}
                      className="border-t border-slate-800"
                    >
                      <td className="p-3">
                        {candidate.display_name_a}
                        <div className="text-xs text-slate-500">
                          {formatUnits(
                            candidate.units_a
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        {candidate.display_name_b}
                        <div className="text-xs text-slate-500">
                          {formatUnits(
                            candidate.units_b
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        {candidate.contact_info_matches ? (
                          <span className="text-green-400">
                            Contact info
                            matches
                          </span>
                        ) : (
                          <span className="text-yellow-400">
                            Contact info
                            differs
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        {candidate.note}
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
