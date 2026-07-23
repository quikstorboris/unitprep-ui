import { formatUnits } from "@/lib/format";
import type { RelatedTenantView, RelatednessSignal } from "@/types/api";

interface RelatedTenantsSectionProps {
  candidates: RelatedTenantView[];
}

const SIGNAL_LABELS: Record<RelatednessSignal, string> = {
  SharedPhone: "Shared phone number",
  SharedEmail: "Shared email address",
  SharedAlternateContact: "Shared alternate contact",
  SharedHomeAddress: "Shared home address",
};

export default function RelatedTenantsSection({
  candidates,
}: RelatedTenantsSectionProps) {
  return (
    <details className="rounded border border-slate-700 p-4">
      <summary className="cursor-pointer text-xl font-semibold">
        Possible Related Tenants (
        {candidates.length})
      </summary>

      <div className="mt-4">
        {candidates.length === 0 ? (
          <div className="text-slate-400">
            No related-tenant
            candidates detected.
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-800">
                  <th className="p-3 text-left">
                    Signal
                  </th>

                  <th className="p-3 text-left">
                    Shared Value
                  </th>

                  <th className="p-3 text-left">
                    Tenants
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
                      key={`${candidate.members
                        .map((m) => m.display_name)
                        .join("-")}-${index}`}
                      className="border-t border-slate-800"
                    >
                      <td className="p-3">
                        {
                          SIGNAL_LABELS[
                            candidate
                              .signal
                          ]
                        }
                      </td>

                      <td className="p-3">
                        {
                          candidate.shared_value
                        }
                      </td>

                      <td className="p-3">
                        {candidate.members
                          .map(
                            (member) =>
                              `${member.display_name} (${formatUnits(member.units)})`
                          )
                          .join(", ")}
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
