import { formatUnits } from "@/lib/format";
import type {
  RelatedTenantEvidenceView,
  RelatedTenantMemberView,
  RelatedTenantView,
  RelatednessSignal,
} from "@/types/api";

interface RelatedTenantsSectionProps {
  candidates: RelatedTenantView[];
}

const SIGNAL_LABELS: Record<RelatednessSignal, string> = {
  SharedPhone: "Shared phone number",
  SharedEmail: "Shared email address",
  SharedAlternateContact: "Shared alternate contact",
  SharedHomeAddress: "Shared home address",
};

function membersPhrase(members: RelatedTenantMemberView[]): string {
  return members
    .map((member) => `${member.display_name} (${formatUnits(member.units)})`)
    .join(", ");
}

/**
 * One household can have multiple pieces of evidence (a spousal pair
 * sharing phone, email, and alternate contact all at once), and
 * different pieces of evidence in a larger household don't
 * necessarily connect the same members (A-B share a phone; B-C share
 * an email; A and C share nothing directly) — each evidence row names
 * only the specific members it applies to, not the whole household,
 * unless they happen to be the same set.
 */
function EvidenceList({
  evidence,
  household,
}: {
  evidence: RelatedTenantEvidenceView[];
  household: RelatedTenantMemberView[];
}) {
  return (
    <ul className="space-y-1">
      {evidence.map((item, index) => {
        const isWholeHousehold = item.members.length === household.length;
        return (
          <li key={`${item.signal}-${item.shared_value}-${index}`}>
            <span className="font-medium">{SIGNAL_LABELS[item.signal]}:</span>{" "}
            {item.shared_value}
            {!isWholeHousehold && (
              <span className="text-slate-400">
                {" "}
                ({membersPhrase(item.members)})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

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
                    Tenants
                  </th>

                  <th className="p-3 text-left">
                    Evidence
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
                        {membersPhrase(candidate.members)}
                      </td>

                      <td className="p-3">
                        <EvidenceList
                          evidence={candidate.evidence}
                          household={candidate.members}
                        />
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
