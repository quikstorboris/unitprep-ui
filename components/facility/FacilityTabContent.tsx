"use client";

import dynamic from "next/dynamic";

import { GeneralTab } from "@/components/facility/GeneralTab";
import type { FacilityDetail, FacilityPolicies } from "@/lib/clientsDetail";

import type { Tab } from "./FacilityTabBar";

function TabLoading() {
  return <p className="text-sm text-slate-400">Loading…</p>;
}

// Only one tab renders at a time, so each non-default tab is its own
// chunk, fetched when first opened. `GeneralTab` is the landing tab and
// stays in the main bundle.
const CoverageTab = dynamic(() => import("@/components/facility/CoverageTab").then((m) => m.CoverageTab), {
  loading: () => <TabLoading />,
});
const DelinquencyTab = dynamic(() => import("@/components/facility/DelinquencyTab").then((m) => m.DelinquencyTab), {
  loading: () => <TabLoading />,
});
const DropboxTab = dynamic(() => import("@/components/facility/DropboxTab").then((m) => m.DropboxTab), {
  loading: () => <TabLoading />,
});
const ElavonTab = dynamic(() => import("@/components/facility/ElavonTab").then((m) => m.ElavonTab), {
  loading: () => <TabLoading />,
});
const FeesTab = dynamic(() => import("@/components/facility/FeesTab").then((m) => m.FeesTab), {
  loading: () => <TabLoading />,
});
const OnboardingWorkTab = dynamic(() => import("@/components/facility/OnboardingWorkTab").then((m) => m.OnboardingWorkTab), {
  loading: () => <TabLoading />,
});
const SpecialsTab = dynamic(() => import("@/components/facility/SpecialsTab").then((m) => m.SpecialsTab), {
  loading: () => <TabLoading />,
});
const TaxesTab = dynamic(() => import("@/components/facility/TaxesTab").then((m) => m.TaxesTab), {
  loading: () => <TabLoading />,
});
const UsersTab = dynamic(() => import("@/components/facility/UsersTab").then((m) => m.UsersTab), {
  loading: () => <TabLoading />,
});

/** Renders the selected facility tab with the props each one needs. */
export function FacilityTabContent({
  tab,
  companyId,
  facilityId,
  facility,
  policies,
  loadFacility,
  loadPolicies,
}: {
  tab: Tab;
  companyId: string;
  facilityId: string;
  facility: FacilityDetail;
  policies: FacilityPolicies;
  loadFacility: () => Promise<void>;
  loadPolicies: () => Promise<void>;
}) {
  switch (tab) {
    case "general":
      return <GeneralTab facility={facility} onChanged={loadFacility} />;
    case "fees":
      return <FeesTab companyId={companyId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />;
    case "taxes":
      return <TaxesTab companyId={companyId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />;
    case "delinquency":
      return (
        <DelinquencyTab companyId={companyId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />
      );
    case "coverage":
      return <CoverageTab companyId={companyId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />;
    case "specials":
      return <SpecialsTab companyId={companyId} facilityId={facilityId} policies={policies} onSaved={loadPolicies} />;
    case "elavon":
      return <ElavonTab companyId={companyId} facilityId={facilityId} />;
    case "users":
      return <UsersTab companyId={companyId} facilityId={facilityId} />;
    case "dropbox":
      return (
        <DropboxTab
          companyId={companyId}
          facilityId={facilityId}
          dropboxFolderUrl={facility.dropbox_folder_url}
          onSaved={loadFacility}
        />
      );
    case "onboarding_work":
      return <OnboardingWorkTab companyId={companyId} facilityId={facilityId} />;
  }
}
