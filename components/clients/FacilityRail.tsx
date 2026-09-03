"use client";

import Link from "next/link";

import type { FacilitySummary } from "@/lib/clientsDetail";

const itemClass = (active: boolean) =>
  `block rounded px-3 py-2 text-sm font-medium transition-colors ${
    active ? "bg-slate-800 text-slate-100" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
  }`;

/**
 * Facility-selector rail -- one button per facility plus a "Company"
 * button above them, per the vault's own Phase 4 design note. Shared
 * between the Company page and every facility page so navigation
 * between them stays in one consistent place, not duplicated per page.
 */
export default function FacilityRail({
  companyId,
  facilities,
  activeFacilityId,
}: {
  companyId: string;
  facilities: FacilitySummary[];
  /** `null` when the Company view itself is active. */
  activeFacilityId: string | null;
}) {
  return (
    <nav className="w-48 shrink-0">
      <ul className="flex flex-col gap-1">
        <li>
          <Link href={`/clients/${companyId}/info`} className={itemClass(activeFacilityId === null)}>
            Company
          </Link>
        </li>
      </ul>

      {facilities.length > 0 && (
        <>
          <p className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Facilities</p>
          <ul className="flex flex-col gap-1">
            {facilities.map((facility) => (
              <li key={facility.id}>
                <Link
                  href={`/clients/${companyId}/facilities/${facility.id}`}
                  className={itemClass(activeFacilityId === facility.id)}
                >
                  {facility.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
