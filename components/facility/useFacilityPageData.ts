"use client";

import { useEffect, useState } from "react";

import {
  getFacilityDetail,
  getFacilityPolicies,
  type FacilityDetail,
  type FacilityPolicies,
} from "@/lib/clientsDetail";

/**
 * The facility page's two facility-scoped reads. Company data comes from
 * the shared `CompanyDetailProvider` (fetched once per company, not per
 * facility -- see that module's own doc comment); only these re-fetch,
 * on `facilityId` alone.
 *
 * `loadPolicies` / `loadFacility` are in-place refreshes (the old data
 * stays on screen until the new arrives), passed to the tabs as
 * `onSaved` -- unlike a plain `useAsyncResource` refetch, which drops
 * back to "loading" and would blank the whole page after every save.
 */
export function useFacilityPageData(clientId: string, facilityId: string) {
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [policies, setPolicies] = useState<FacilityPolicies | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Same idea as `loadPolicies` above, for the General/DropBox tabs' own save.
  async function loadFacility() {
    const result = await getFacilityDetail(clientId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setFacility(result.data);
  }

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

  return { facility, policies, loadError, loadFacility, loadPolicies };
}
