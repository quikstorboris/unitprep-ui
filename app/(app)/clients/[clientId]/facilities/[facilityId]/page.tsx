"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import FacilityRail from "@/components/clients/FacilityRail";
import FieldReferenceHelp from "@/components/clients/FieldReferenceHelp";
import { FacilityTabBar, isTab, type Tab } from "@/components/facility/FacilityTabBar";
import { FacilityTabContent } from "@/components/facility/FacilityTabContent";
import { useFacilityPageData } from "@/components/facility/useFacilityPageData";

/**
 * Facility page -- originally General | Users | DropBox | Elavon |
 * Facility Policies per the vault's Phase 4 design note, revised
 * 2026-09-04 (Boris's call): the single Facility Policies tab is now
 * five separate tabs -- Fees | Taxes | Delinquency | Coverage |
 * Specials -- since each became independently editable (see
 * `PolicySectionHeader`'s own doc comment) and stacking five edit forms
 * on one tab would be unwieldy. DropBox is the one remaining
 * placeholder.
 *
 * 2026-09-09: this page used to hold all nine tabs' JSX inline
 * (~2300 lines). Each tab is now its own component under
 * `components/facility/` -- this file is just the shell: tab-switch
 * state and routing. The facility-scoped fetches live in
 * `useFacilityPageData`, the tab buttons in `FacilityTabBar` and the
 * tab switch (with each tab's lazy chunk) in `FacilityTabContent`.
 */
export default function FacilityDetailPage() {
  const { clientId, facilityId } = useParams<{ clientId: string; facilityId: string }>();
  const searchParams = useSearchParams();
  const { company, loadError: companyLoadError } = useCompanyDetail();
  const { facility, policies, loadError, loadFacility, loadPolicies } = useFacilityPageData(clientId, facilityId);

  // Seeded from `?tab=` when present (e.g. the Dedup completion screen's
  // "View in Onboarding Work" link) so that deep link actually lands on
  // the right tab instead of always defaulting to General -- read once
  // at mount, not kept in sync with the URL afterward, same as every
  // other piece of local UI-only state on this page.
  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get("tab");
    return isTab(requested) ? requested : "general";
  });

  const effectiveLoadError = companyLoadError ?? loadError;

  if (effectiveLoadError) {
    return (
      <main className="p-8">
        <p role="alert" className="text-sm text-red-400">
          {effectiveLoadError}
        </p>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="p-8">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  // The rail (and company data behind it) is already loaded by this
  // point -- only the facility-specific content below needs its own
  // "Loading…" state while switching facilities, so the rail and page
  // chrome stay put instead of the whole page blanking out.
  return (
    <main className="p-8">
      <div className="mx-auto flex max-w-6xl gap-8">
        <FacilityRail companyId={clientId} facilities={company.facilities} activeFacilityId={facilityId} />

        {!facility || !policies ? (
          <div className="flex flex-1 flex-col gap-6">
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="min-w-0 break-words text-2xl font-bold">{facility.name}</h1>
              <div className="shrink-0">
                <FieldReferenceHelp />
              </div>
            </div>

            <FacilityTabBar tab={tab} onChange={setTab} />

            <FacilityTabContent
              tab={tab}
              companyId={clientId}
              facilityId={facilityId}
              facility={facility}
              policies={policies}
              loadFacility={loadFacility}
              loadPolicies={loadPolicies}
            />
          </div>
        )}
      </div>
    </main>
  );
}
