"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { getCompanyDetail, type CompanyDetail } from "@/lib/clientsDetail";
import { queryKeys } from "@/lib/queryKeys";
import { queryErrorMessage, unwrap } from "@/lib/queryResult";

/**
 * Shares one `getCompanyDetail` read per `companyId` across the Company
 * page and every Facility page under it, through the query cache: clicking
 * between facilities reuses it (2026-09-03 fix, originally by keeping the
 * provider's own state), and now so does coming back to a company a moment
 * later -- the cached detail shows at once and is refreshed in the
 * background once it is older than `QUERY_STALE_MS`.
 *
 * `refetch()` is for after a write: it refreshes the detail in place (the
 * old data stays on screen until the new arrives) instead of blanking the
 * page back to "Loading...".
 */
interface CompanyDetailContextValue {
  company: CompanyDetail | null;
  loadError: string | null;
  refetch: () => void;
}

const CompanyDetailContext = createContext<CompanyDetailContextValue | null>(null);

export function CompanyDetailProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, error } = useQuery({
    queryKey: queryKeys.company(companyId),
    queryFn: async () => unwrap(await getCompanyDetail(companyId)),
  });

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.company(companyId), exact: true });
  }, [queryClient, companyId]);

  // An error only counts while there is nothing to show: a failed
  // background refresh must not blank a page that already has its data.
  const loadError = data === undefined ? queryErrorMessage(error) : null;

  const value = useMemo(
    () => ({ company: data ?? null, loadError, refetch }),
    [data, loadError, refetch],
  );

  return <CompanyDetailContext.Provider value={value}>{children}</CompanyDetailContext.Provider>;
}

export function useCompanyDetail(): CompanyDetailContextValue {
  const value = useContext(CompanyDetailContext);
  if (!value) {
    throw new Error("useCompanyDetail must be used within a CompanyDetailProvider");
  }
  return value;
}

/** The company's facility names, empty until the detail has loaded. For the
 * "Which facility?" pickers on the tool pages, which used to read them from
 * the full client list. */
export function useFacilityNames(): string[] {
  const { company } = useCompanyDetail();
  return useMemo(() => company?.facilities.map((facility) => facility.name) ?? [], [company]);
}
