"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import { CoverageTab } from "@/components/facility/CoverageTab";
import { DelinquencyTab } from "@/components/facility/DelinquencyTab";
import { DropboxTab } from "@/components/facility/DropboxTab";
import { ElavonTab } from "@/components/facility/ElavonTab";
import { FeesTab } from "@/components/facility/FeesTab";
import { GeneralTab } from "@/components/facility/GeneralTab";
import { SpecialsTab } from "@/components/facility/SpecialsTab";
import { TaxesTab } from "@/components/facility/TaxesTab";
import { UsersTab } from "@/components/facility/UsersTab";
import FacilityRail from "@/components/clients/FacilityRail";
import FieldReferenceHelp from "@/components/clients/FieldReferenceHelp";
import { getFacilityDetail, getFacilityPolicies, type FacilityDetail, type FacilityPolicies } from "@/lib/clientsDetail";

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
 * state, the two facility-scoped fetches (`loadFacility`/
 * `loadPolicies`), and routing.
 */
type Tab = "general" | "users" | "dropbox" | "elavon" | "fees" | "taxes" | "delinquency" | "coverage" | "specials";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "General" },
  { key: "users", label: "Users" },
  { key: "dropbox", label: "DropBox" },
  { key: "elavon", label: "Elavon" },
  { key: "fees", label: "Fees" },
  { key: "taxes", label: "Taxes" },
  { key: "delinquency", label: "Delinquency" },
  { key: "coverage", label: "Coverage" },
  { key: "specials", label: "Specials" },
];

function tabButtonClass(active: boolean) {
  return `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
  }`;
}

export default function FacilityDetailPage() {
  const { clientId, facilityId } = useParams<{ clientId: string; facilityId: string }>();
  const { company, loadError: companyLoadError } = useCompanyDetail();

  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [policies, setPolicies] = useState<FacilityPolicies | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("general");

  // Re-fetches just the policies -- passed to each split Fees/Taxes/
  // Delinquency/Coverage/Specials tab as `onSaved`, so a save reflects
  // its own (possibly just-flagged-exempt) fresh state immediately
  // without a full page reload.
  async function loadPolicies() {
    const result = await getFacilityPolicies(clientId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setPolicies(result.data);
  }

  // Same idea as `loadPolicies` above, for the DropBox tab's own save.
  async function loadFacility() {
    const result = await getFacilityDetail(clientId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setFacility(result.data);
  }

  // Company data comes from the shared `CompanyDetailProvider` (fetched
  // once per company, not per facility -- see that module's own doc
  // comment). Only the facility-specific reads re-fetch here, on
  // `facilityId` alone.
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      // Reset here (inside the effect's async callback, not
      // synchronously in the effect body) per the
      // `react-hooks/set-state-in-effect` rule.
      if (cancelled) return;
      setFacility(null);
      setPolicies(null);
      setLoadError(null);

      const [facilityResult, policiesResult] = await Promise.all([
        getFacilityDetail(clientId, facilityId),
        getFacilityPolicies(clientId, facilityId),
      ]);

      if (cancelled) return;
      if (facilityResult.kind !== "ok") {
        setLoadError(facilityResult.message);
        return;
      }
      if (policiesResult.kind !== "ok") {
        setLoadError(policiesResult.message);
        return;
      }

      setLoadError(null);
      setFacility(facilityResult.data);
      setPolicies(policiesResult.data);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId, facilityId]);

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
              <h1 className="text-2xl font-bold">{facility.name}</h1>
              <FieldReferenceHelp />
            </div>

            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={tabButtonClass(tab === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "general" && <GeneralTab facility={facility} />}
            {tab === "fees" && (
              <FeesTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "taxes" && (
              <TaxesTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "delinquency" && (
              <DelinquencyTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "coverage" && (
              <CoverageTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "specials" && (
              <SpecialsTab companyId={clientId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
            )}
            {tab === "elavon" && <ElavonTab companyId={clientId} facilityId={facilityId} />}
            {tab === "users" && <UsersTab companyId={clientId} facilityId={facilityId} />}
            {tab === "dropbox" && (
              <DropboxTab
                companyId={clientId}
                facilityId={facilityId}
                dropboxFolderUrl={facility.dropbox_folder_url}
                onSaved={loadFacility}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
