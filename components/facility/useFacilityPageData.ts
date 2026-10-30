"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  getFacilityDetail,
  getFacilityPolicies,
  type FacilityDetail,
  type FacilityPolicies,
} from "@/lib/clientsDetail";
import { queryKeys } from "@/lib/queryKeys";
import { queryErrorMessage, unwrap } from "@/lib/queryResult";

/**
 * The facility page's two facility-scoped reads, kept in the query cache.
 * Company data comes from the shared `CompanyDetailProvider` (fetched once
 * per company, not per facility -- see that module's own doc comment); only
 * these two are per facility, so switching facilities loads just them, and
 * coming back to a facility seen moments ago shows it at once.
 *
 * `loadPolicies` / `loadFacility` are in-place refreshes (the old data
 * stays on screen until the new arrives), passed to the tabs as `onSaved`
 * -- they resolve once the refreshed data has landed.
 *
 * A failed read is reported even when an older copy is cached: these
 * screens are edit forms, and showing stale values after a save looked
 * successful would invite overwriting a colleague's change with them.
 */
export function useFacilityPageData(clientId: string, facilityId: string) {
  const queryClient = useQueryClient();
  const facilityKey = queryKeys.facility(clientId, facilityId);
  const policiesKey = queryKeys.facilityPolicies(clientId, facilityId);

  const facilityQuery = useQuery({
    queryKey: facilityKey,
    queryFn: async (): Promise<FacilityDetail> => unwrap(await getFacilityDetail(clientId, facilityId)),
  });
  const policiesQuery = useQuery({
    queryKey: policiesKey,
    queryFn: async (): Promise<FacilityPolicies> => unwrap(await getFacilityPolicies(clientId, facilityId)),
  });

  // Re-fetches just the policies -- passed to each split Fees/Taxes/
  // Delinquency/Coverage/Specials tab as `onSaved`, so a save reflects
  // its own (possibly just-flagged-exempt) fresh state immediately
  // without a full page reload.
  const loadPolicies = useCallback(
    () => queryClient.invalidateQueries({ queryKey: policiesKey, exact: true }),
    [queryClient, policiesKey],
  );

  // Same idea as `loadPolicies` above, for the General/DropBox tabs' own save.
  const loadFacility = useCallback(
    () => queryClient.invalidateQueries({ queryKey: facilityKey, exact: true }),
    [queryClient, facilityKey],
  );

  const loadError = queryErrorMessage(facilityQuery.error) ?? queryErrorMessage(policiesQuery.error);

  return {
    facility: facilityQuery.data ?? null,
    policies: policiesQuery.data ?? null,
    loadError,
    loadFacility,
    loadPolicies,
  };
}
