import FlaggedGroupsSection from "@/components/dedup/FlaggedGroupsSection";
import RelatedTenantsSection from "@/components/dedup/RelatedTenantsSection";
import TypoVariantsSection from "@/components/dedup/TypoVariantsSection";
import { formatUnits } from "@/lib/format";
import type { IdentifiedMatchView, UnidentifiedMode, UnidentifiedView } from "@/types/api";

interface UnidentifiedTenantsSectionProps {
  section: UnidentifiedView | null | undefined;
  /**
   * Called with the user's choice. Leave out where the choice can't be
   * changed (a viewer without permission), and the section is read-only.
   */
  onChoose?: (mode: UnidentifiedMode) => void;
  /** A choice is being applied. */
  busy?: boolean;
  /** The last choice failed. */
  error?: string | null;
}

function matchPhrase(match: IdentifiedMatchView): string {
  return match.units.length === 0
    ? `customer ID ${match.tenant_id}`
    : `customer ID ${match.tenant_id} (${formatUnits(match.units)})`;
}

const BUTTON =
  "rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Tenants the source system gave no customer id. They can't be grouped
 * reliably, so the check leaves them out of the main sections and lists
 * them here; the user decides whether to match them by name against every
 * tenant or to ignore them. Re-checking is cheap, so the choice can be
 * changed at any time.
 */
export default function UnidentifiedTenantsSection({
  section,
  onChoose,
  busy = false,
  error = null,
}: UnidentifiedTenantsSectionProps) {
  if (!section || section.tenants.length === 0) {
    return null;
  }

  const matched = section.mode === "matched_by_name";
  const pending = section.mode === "pending";

  return (
    <details open={pending} className="rounded border border-amber-700/60 p-4">
      <summary className="cursor-pointer text-xl font-semibold">
        Tenants without a customer ID ({section.tenants.length})
      </summary>

      <div className="mt-4 space-y-4">
        <div className="rounded bg-amber-950/40 p-3 text-sm text-amber-200">
          {pending && (
            <p>
              These tenants have no customer ID in the source file, so they were left out of the checks above
              rather than guessed at. Match them by name against every tenant, or ignore them?
            </p>
          )}
          {section.mode === "ignored" && (
            <p>Ignored: these tenants were not checked against the others.</p>
          )}
          {matched && (
            <p>Matched by name: each tenant below was compared by name with every tenant in the file.</p>
          )}

          {onChoose && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {!matched && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChoose("matched_by_name")}
                  className={`${BUTTON} bg-blue-600 text-white hover:bg-blue-500`}
                >
                  {busy ? "Checking…" : "Match by name"}
                </button>
              )}
              {section.mode !== "ignored" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onChoose("ignored")}
                  className={`${BUTTON} border border-slate-500 text-slate-200 hover:bg-slate-800`}
                >
                  {matched ? "Ignore these instead" : "Ignore"}
                </button>
              )}
              {error && (
                <span role="alert" className="text-red-300">
                  {error}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="max-h-96 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800">
                <th className="p-3 text-left">Tenant</th>
                <th className="p-3 text-left">Units</th>
                {matched && <th className="p-3 text-left">Same name already under</th>}
              </tr>
            </thead>

            <tbody>
              {section.tenants.map((tenant, index) => (
                <tr key={`${tenant.display_name}-${index}`} className="border-t border-slate-800">
                  <td className="p-3">{tenant.display_name}</td>
                  <td className="p-3">{formatUnits(tenant.units)}</td>
                  {matched && (
                    <td className="p-3">
                      {tenant.same_name_as.length === 0 ? (
                        <span className="text-slate-500">No other tenant has this name</span>
                      ) : (
                        <ul className="space-y-1">
                          {tenant.same_name_as.map((match) => (
                            <li key={match.tenant_id} className="text-yellow-300">
                              {matchPhrase(match)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {matched && (
          <div className="space-y-4">
            {section.flagged_groups.length > 0 && <FlaggedGroupsSection groups={section.flagged_groups} />}
            {section.typo_variant_candidates.length > 0 && (
              <TypoVariantsSection candidates={section.typo_variant_candidates} />
            )}
            {section.related_tenant_candidates.length > 0 && (
              <RelatedTenantsSection candidates={section.related_tenant_candidates} />
            )}
          </div>
        )}
      </div>
    </details>
  );
}
