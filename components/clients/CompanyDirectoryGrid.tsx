"use client";

import Link from "next/link";

import CompanyCardMenu from "@/components/clients/CompanyCardMenu";
import type { CompanyDirectoryEntry } from "@/lib/clientsDirectory";

/**
 * The 5-column grid of company links (legal name only, per the approved
 * plan) plus each one's archive/unarchive/delete kebab menu -- real links,
 * not click handlers, so the browser can prefetch the page, "open in new
 * tab" and middle-click work, and the status bar shows where it goes --
 * split out of `app/(app)/clients/page.tsx` so that page stays scoped
 * to search/filter state and data-fetching, not also owning this
 * rendering. Used both for a single Implementation Manager section and
 * for the flat Archived list.
 */
export interface CompanyDirectoryGridProps {
  companies: CompanyDirectoryEntry[];
  pendingId: string | null;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

// `pr-8` leaves room for the kebab overlaid in the top-right corner (see
// below) so long company names truncate before ever running under it.
const companyButtonClass =
  "w-full min-w-0 truncate rounded border border-slate-700 px-3 py-3 pr-8 text-left text-sm font-medium transition-colors hover:bg-slate-800";

export default function CompanyDirectoryGrid({
  companies,
  pendingId,
  onArchive,
  onUnarchive,
  onDelete,
}: CompanyDirectoryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {companies.map((company) => (
        // `relative` so the kebab menu below can overlay this card's
        // corner instead of sitting in its own separate box next to the
        // link -- a sibling of the link, not nested inside it, so a click
        // on the dots never also follows the link.
        <div key={company.id} className="relative">
          <Link
            href={`/clients/${company.id}/info`}
            title={company.legal_name}
            className={`block ${companyButtonClass}`}
          >
            {company.legal_name}
          </Link>

          {/* `top-1.5` (a fixed offset), not `top-1/2 -translate-y-1/2`:
              a `transform` establishes a new stacking context, which
              trapped the dropdown panel's own `z-10` inside it -- so it
              no longer out-ranked the *next row's* button (painted later
              in DOM order) and rendered underneath it. Fixed positioning
              keeps this wrapper transform-free so `z-10` escapes to the
              real page-level stacking context, same as every other
              dropdown panel in the app (e.g. MultiSelectDropdown's). */}
          <div className="absolute right-1 top-1.5">
            <CompanyCardMenu
              companyName={company.legal_name}
              archived={company.archived_at !== null}
              disabled={pendingId === company.id}
              onArchive={() => onArchive(company.id)}
              onUnarchive={() => onUnarchive(company.id)}
              onDelete={() => onDelete(company.id, company.legal_name)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
